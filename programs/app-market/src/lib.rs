use anchor_lang::prelude::*;

declare_id!("AppMkt1111111111111111111111111111111111111");

/// App Market Escrow Program
/// Handles secure escrow for marketplace transactions
///
/// Flow:
/// 1. Seller creates listing + escrow -> Both PDAs created atomically
/// 2. Buyer places bid / buys now -> Funds locked in existing escrow
/// 3. Auction ends -> Winner determined
/// 4. Transfer period -> Seller transfers assets and confirms on-chain
/// 5. Buyer confirms receipt -> Escrow releases to seller
/// 6. OR Dispute -> Admin resolves
/// 7. OR Emergency refund -> If seller never confirmed transfer

#[program]
pub mod app_market {
    use super::*;

    // ============================================
    // CONSTANTS
    // ============================================

    /// Basis points divisor (100% = 10000 basis points)
    pub const BASIS_POINTS_DIVISOR: u64 = 10000;

    /// Platform fee: 5% (500 basis points)
    pub const PLATFORM_FEE_BPS: u64 = 500;
    /// Dispute fee: 2% (200 basis points)
    pub const DISPUTE_FEE_BPS: u64 = 200;

    /// Maximum platform fee: 10% (prevents accidental/malicious fee rug)
    pub const MAX_PLATFORM_FEE_BPS: u64 = 1000;
    /// Maximum dispute fee: 5%
    pub const MAX_DISPUTE_FEE_BPS: u64 = 500;

    /// Transfer deadline: 7 days in seconds
    pub const TRANSFER_DEADLINE_SECONDS: i64 = 7 * 24 * 60 * 60;
    /// Maximum auction duration: 30 days
    pub const MAX_AUCTION_DURATION_SECONDS: i64 = 30 * 24 * 60 * 60;

    /// Minimum bid increment: 5% (500 basis points)
    pub const MIN_BID_INCREMENT_BPS: u64 = 500;
    /// Absolute minimum bid increment: 0.1 SOL (100,000,000 lamports)
    pub const MIN_BID_INCREMENT_LAMPORTS: u64 = 100_000_000;

    /// Anti-sniping window: 15 minutes before auction end
    pub const ANTI_SNIPE_WINDOW: i64 = 15 * 60;
    /// Extension time when bid placed in anti-snipe window
    pub const ANTI_SNIPE_EXTENSION: i64 = 15 * 60;

    /// Admin timelock: 48 hours for sensitive operations
    pub const ADMIN_TIMELOCK_SECONDS: i64 = 48 * 60 * 60;

    // ============================================
    // INSTRUCTIONS
    // ============================================

    /// Initialize the marketplace config (one-time setup)
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_fee_bps: u64,
        dispute_fee_bps: u64,
    ) -> Result<()> {
        // SECURITY: Validate fee bounds
        require!(
            platform_fee_bps <= MAX_PLATFORM_FEE_BPS,
            AppMarketError::FeeTooHigh
        );
        require!(
            dispute_fee_bps <= MAX_DISPUTE_FEE_BPS,
            AppMarketError::FeeTooHigh
        );

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.platform_fee_bps = platform_fee_bps;
        config.dispute_fee_bps = dispute_fee_bps;
        config.total_volume = 0;
        config.total_sales = 0;
        config.paused = false;
        config.pending_treasury = None;
        config.pending_treasury_at = None;
        config.pending_admin = None;
        config.pending_admin_at = None;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Propose treasury change (step 1 of timelock)
    pub fn propose_treasury_change(
        ctx: Context<ProposeTreasuryChange>,
        new_treasury: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            AppMarketError::NotAdmin
        );

        let config = &mut ctx.accounts.config;
        config.pending_treasury = Some(new_treasury);
        config.pending_treasury_at = Some(Clock::get()?.unix_timestamp);

        emit!(TreasuryChangeProposed {
            old_treasury: config.treasury,
            new_treasury,
            executable_at: Clock::get()?.unix_timestamp + ADMIN_TIMELOCK_SECONDS,
        });

        Ok(())
    }

    /// Execute treasury change (step 2 of timelock, after 48 hours)
    pub fn execute_treasury_change(ctx: Context<ExecuteTreasuryChange>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            AppMarketError::NotAdmin
        );

        let config = &mut ctx.accounts.config;
        let clock = Clock::get()?;

        require!(
            config.pending_treasury.is_some(),
            AppMarketError::NoPendingChange
        );

        let proposed_at = config.pending_treasury_at.unwrap();
        require!(
            clock.unix_timestamp >= proposed_at + ADMIN_TIMELOCK_SECONDS,
            AppMarketError::TimelockNotExpired
        );

        config.treasury = config.pending_treasury.unwrap();
        config.pending_treasury = None;
        config.pending_treasury_at = None;

        emit!(TreasuryChanged {
            new_treasury: config.treasury,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Propose admin change (step 1 of timelock)
    pub fn propose_admin_change(
        ctx: Context<ProposeAdminChange>,
        new_admin: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            AppMarketError::NotAdmin
        );

        let config = &mut ctx.accounts.config;
        config.pending_admin = Some(new_admin);
        config.pending_admin_at = Some(Clock::get()?.unix_timestamp);

        emit!(AdminChangeProposed {
            old_admin: config.admin,
            new_admin,
            executable_at: Clock::get()?.unix_timestamp + ADMIN_TIMELOCK_SECONDS,
        });

        Ok(())
    }

    /// Execute admin change (step 2 of timelock, after 48 hours)
    pub fn execute_admin_change(ctx: Context<ExecuteAdminChange>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            AppMarketError::NotAdmin
        );

        let config = &mut ctx.accounts.config;
        let clock = Clock::get()?;

        require!(
            config.pending_admin.is_some(),
            AppMarketError::NoPendingChange
        );

        let proposed_at = config.pending_admin_at.unwrap();
        require!(
            clock.unix_timestamp >= proposed_at + ADMIN_TIMELOCK_SECONDS,
            AppMarketError::TimelockNotExpired
        );

        config.admin = config.pending_admin.unwrap();
        config.pending_admin = None;
        config.pending_admin_at = None;

        emit!(AdminChanged {
            new_admin: config.admin,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Set paused state (admin only, no timelock for emergencies)
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            AppMarketError::NotAdmin
        );

        ctx.accounts.config.paused = paused;

        emit!(ContractPausedEvent {
            paused,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Create a new listing with escrow initialized atomically
    pub fn create_listing(
        ctx: Context<CreateListing>,
        salt: u64,
        starting_price: u64,
        reserve_price: Option<u64>,
        buy_now_price: Option<u64>,
        duration_seconds: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);
        require!(starting_price > 0, AppMarketError::InvalidPrice);
        require!(
            duration_seconds > 0 && duration_seconds <= MAX_AUCTION_DURATION_SECONDS,
            AppMarketError::InvalidDuration
        );

        let listing = &mut ctx.accounts.listing;
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Initialize listing
        listing.seller = ctx.accounts.seller.key();
        listing.listing_id = format!("{}-{}", ctx.accounts.seller.key(), salt);
        listing.starting_price = starting_price;
        listing.reserve_price = reserve_price;
        listing.buy_now_price = buy_now_price;
        listing.current_bid = 0;
        listing.current_bidder = None;
        listing.start_time = clock.unix_timestamp;
        listing.end_time = clock.unix_timestamp + duration_seconds;
        listing.status = ListingStatus::Active;
        // SECURITY: Lock fees at listing creation time
        listing.platform_fee_bps = ctx.accounts.config.platform_fee_bps;
        listing.dispute_fee_bps = ctx.accounts.config.dispute_fee_bps;
        listing.bump = ctx.bumps.listing;

        // Initialize escrow (seller pays rent)
        escrow.listing = listing.key();
        escrow.amount = 0;
        escrow.bump = ctx.bumps.escrow;

        emit!(ListingCreated {
            listing: listing.key(),
            seller: listing.seller,
            listing_id: listing.listing_id.clone(),
            starting_price,
            end_time: listing.end_time,
            platform_fee_bps: listing.platform_fee_bps,
        });

        Ok(())
    }

    /// Place a bid on a listing
    pub fn place_bid(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // CHECKS: All validations first
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(clock.unix_timestamp < listing.end_time, AppMarketError::AuctionEnded);
        require!(ctx.accounts.bidder.key() != listing.seller, AppMarketError::SellerCannotBid);

        // SECURITY: Pre-check bidder has sufficient balance
        require!(
            ctx.accounts.bidder.lamports() >= amount,
            AppMarketError::InsufficientBalance
        );

        // SECURITY: Enforce minimum bid increment to prevent spam
        if listing.current_bid > 0 {
            let increment = listing.current_bid
                .checked_mul(MIN_BID_INCREMENT_BPS)
                .ok_or(AppMarketError::MathOverflow)?
                .checked_div(BASIS_POINTS_DIVISOR)
                .ok_or(AppMarketError::MathOverflow)?;

            let min_increment = increment.max(MIN_BID_INCREMENT_LAMPORTS);
            let min_bid = listing.current_bid
                .checked_add(min_increment)
                .ok_or(AppMarketError::MathOverflow)?;

            require!(amount >= min_bid, AppMarketError::BidIncrementTooSmall);
        } else {
            require!(amount >= listing.starting_price, AppMarketError::BidTooLow);
        }

        // SECURITY: Validate previous_bidder (including None case)
        if let Some(previous_bidder) = listing.current_bidder {
            require!(
                ctx.accounts.previous_bidder.key() == previous_bidder,
                AppMarketError::InvalidPreviousBidder
            );
        } else {
            // No previous bidder -> must pass system program
            require!(
                ctx.accounts.previous_bidder.key() == system_program::ID,
                AppMarketError::InvalidPreviousBidder
            );
        }

        // EFFECTS: Update state BEFORE external calls
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;
        listing.current_bid = amount;
        listing.current_bidder = Some(ctx.accounts.bidder.key());

        // Update escrow amount tracking BEFORE transfers
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_add(amount)
            .ok_or(AppMarketError::MathOverflow)?;

        // SECURITY: Anti-sniping - extend auction if bid placed near end
        if clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
            listing.end_time = clock.unix_timestamp
                .checked_add(ANTI_SNIPE_EXTENSION)
                .ok_or(AppMarketError::MathOverflow)?;
        }

        // INTERACTIONS: External calls LAST
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        // Refund previous bidder if exists
        if let Some(_previous_bidder) = old_bidder {
            if old_bid > 0 {
                let seeds = &[
                    b"escrow",
                    listing.to_account_info().key.as_ref(),
                    &[ctx.accounts.escrow.bump],
                ];
                let signer = &[&seeds[..]];

                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.previous_bidder.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, old_bid)?;

                // Update escrow amount tracking
                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(old_bid)
                    .ok_or(AppMarketError::MathOverflow)?;
            }
        }

        emit!(BidPlaced {
            listing: listing.key(),
            bidder: ctx.accounts.bidder.key(),
            amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Buy now (instant purchase)
    pub fn buy_now(ctx: Context<BuyNow>) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // CHECKS
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(clock.unix_timestamp < listing.end_time, AppMarketError::AuctionEnded);
        require!(listing.buy_now_price.is_some(), AppMarketError::BuyNowNotEnabled);
        require!(ctx.accounts.buyer.key() != listing.seller, AppMarketError::SellerCannotBuy);

        let buy_now_price = listing.buy_now_price.unwrap();

        // SECURITY: Pre-check buyer has sufficient balance
        require!(
            ctx.accounts.buyer.lamports() >= buy_now_price,
            AppMarketError::InsufficientBalance
        );

        // Validate previous_bidder
        if let Some(previous_bidder) = listing.current_bidder {
            require!(
                ctx.accounts.previous_bidder.key() == previous_bidder,
                AppMarketError::InvalidPreviousBidder
            );
        } else {
            require!(
                ctx.accounts.previous_bidder.key() == system_program::ID,
                AppMarketError::InvalidPreviousBidder
            );
        }

        // EFFECTS
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;
        listing.current_bid = buy_now_price;
        listing.current_bidder = Some(ctx.accounts.buyer.key());
        listing.status = ListingStatus::Sold;
        listing.end_time = clock.unix_timestamp;

        // Update escrow tracking BEFORE transfers
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_add(buy_now_price)
            .ok_or(AppMarketError::MathOverflow)?;

        // INTERACTIONS
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, buy_now_price)?;

        // Refund any existing bidder
        if let Some(_previous_bidder) = old_bidder {
            if old_bid > 0 {
                let seeds = &[
                    b"escrow",
                    listing.to_account_info().key.as_ref(),
                    &[ctx.accounts.escrow.bump],
                ];
                let signer = &[&seeds[..]];

                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.previous_bidder.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, old_bid)?;

                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(old_bid)
                    .ok_or(AppMarketError::MathOverflow)?;
            }
        }

        // Create transaction record
        let transaction = &mut ctx.accounts.transaction;
        transaction.listing = listing.key();
        transaction.seller = listing.seller;
        transaction.buyer = ctx.accounts.buyer.key();
        transaction.sale_price = buy_now_price;

        // SECURITY: Use LOCKED fees from listing, not current config
        transaction.platform_fee = buy_now_price
            .checked_mul(listing.platform_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.seller_proceeds = buy_now_price
            .checked_sub(transaction.platform_fee)
            .ok_or(AppMarketError::MathOverflow)?;

        transaction.status = TransactionStatus::InEscrow;
        transaction.transfer_deadline = clock.unix_timestamp
            .checked_add(TRANSFER_DEADLINE_SECONDS)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.created_at = clock.unix_timestamp;
        transaction.seller_confirmed_transfer = false;
        transaction.seller_confirmed_at = None;
        transaction.completed_at = None;
        transaction.bump = ctx.bumps.transaction;

        emit!(SaleCompleted {
            listing: listing.key(),
            transaction: transaction.key(),
            buyer: ctx.accounts.buyer.key(),
            seller: listing.seller,
            amount: buy_now_price,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Settle auction (called after auction ends)
    pub fn settle_auction(ctx: Context<SettleAuction>) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Validations
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(clock.unix_timestamp >= listing.end_time, AppMarketError::AuctionNotEnded);

        // SECURITY: Only allow seller, winner, or admin to settle
        let is_seller = ctx.accounts.payer.key() == listing.seller;
        let is_winner = listing.current_bidder
            .map(|bidder| ctx.accounts.payer.key() == bidder)
            .unwrap_or(false);
        let is_admin = ctx.accounts.payer.key() == ctx.accounts.config.admin;

        require!(
            is_seller || is_winner || is_admin,
            AppMarketError::UnauthorizedSettlement
        );

        // Check if reserve price was met
        if let Some(reserve) = listing.reserve_price {
            if listing.current_bid < reserve {
                // Reserve not met - refund bidder and cancel
                if let Some(stored_bidder) = listing.current_bidder {
                    if listing.current_bid > 0 {
                        // SECURITY: Validate bidder account matches stored bidder
                        require!(
                            ctx.accounts.bidder.key() == stored_bidder,
                            AppMarketError::InvalidBidder
                        );

                        // SECURITY: Validate escrow balance
                        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
                        let rent = Rent::get()?.minimum_balance(
                            ctx.accounts.escrow.to_account_info().data_len()
                        );
                        require!(
                            escrow_balance >= listing.current_bid + rent,
                            AppMarketError::InsufficientEscrowBalance
                        );

                        let seeds = &[
                            b"escrow",
                            listing.to_account_info().key.as_ref(),
                            &[ctx.accounts.escrow.bump],
                        ];
                        let signer = &[&seeds[..]];

                        let cpi_ctx = CpiContext::new_with_signer(
                            ctx.accounts.system_program.to_account_info(),
                            anchor_lang::system_program::Transfer {
                                from: ctx.accounts.escrow.to_account_info(),
                                to: ctx.accounts.bidder.to_account_info(),
                            },
                            signer,
                        );
                        anchor_lang::system_program::transfer(cpi_ctx, listing.current_bid)?;

                        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                            .checked_sub(listing.current_bid)
                            .ok_or(AppMarketError::MathOverflow)?;
                    }
                }
                listing.status = ListingStatus::Cancelled;

                emit!(AuctionCancelled {
                    listing: listing.key(),
                    reason: "Reserve price not met".to_string(),
                });

                return Ok(());
            }
        }

        // No bids - cancel auction
        if listing.current_bidder.is_none() {
            listing.status = ListingStatus::Cancelled;

            emit!(AuctionCancelled {
                listing: listing.key(),
                reason: "No bids received".to_string(),
            });

            return Ok(());
        }

        // Auction successful - create transaction
        listing.status = ListingStatus::Sold;

        let transaction = &mut ctx.accounts.transaction;
        transaction.listing = listing.key();
        transaction.seller = listing.seller;
        transaction.buyer = listing.current_bidder.unwrap();
        transaction.sale_price = listing.current_bid;

        // SECURITY: Use LOCKED fees from listing, not current config
        transaction.platform_fee = listing.current_bid
            .checked_mul(listing.platform_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.seller_proceeds = listing.current_bid
            .checked_sub(transaction.platform_fee)
            .ok_or(AppMarketError::MathOverflow)?;

        transaction.status = TransactionStatus::InEscrow;
        transaction.transfer_deadline = clock.unix_timestamp
            .checked_add(TRANSFER_DEADLINE_SECONDS)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.created_at = clock.unix_timestamp;
        transaction.seller_confirmed_transfer = false;
        transaction.seller_confirmed_at = None;
        transaction.completed_at = None;
        transaction.bump = ctx.bumps.transaction;

        emit!(SaleCompleted {
            listing: listing.key(),
            transaction: transaction.key(),
            buyer: transaction.buyer,
            seller: listing.seller,
            amount: listing.current_bid,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Seller confirms they have transferred all assets (on-chain proof)
    pub fn seller_confirm_transfer(ctx: Context<SellerConfirmTransfer>) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // Validations
        require!(
            transaction.status == TransactionStatus::InEscrow,
            AppMarketError::InvalidTransactionStatus
        );
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::NotSeller
        );
        require!(
            !transaction.seller_confirmed_transfer,
            AppMarketError::AlreadyConfirmed
        );

        transaction.seller_confirmed_transfer = true;
        transaction.seller_confirmed_at = Some(clock.unix_timestamp);

        emit!(SellerConfirmedTransfer {
            transaction: transaction.key(),
            seller: transaction.seller,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Buyer confirms receipt of all assets - releases escrow
    pub fn confirm_receipt(ctx: Context<ConfirmReceipt>) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // Validations
        require!(transaction.status == TransactionStatus::InEscrow, AppMarketError::InvalidTransactionStatus);
        require!(ctx.accounts.buyer.key() == transaction.buyer, AppMarketError::NotBuyer);
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::InvalidSeller
        );

        // SECURITY: Validate escrow balance (4 checks)
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.escrow.to_account_info().data_len()
        );

        // Check 1: Sufficient for payment + rent
        let required_balance = transaction.platform_fee
            .checked_add(transaction.seller_proceeds)
            .ok_or(AppMarketError::MathOverflow)?;
        require!(
            escrow_balance >= required_balance + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // Check 2: Tracked amount matches reality
        let tracked_with_rent = ctx.accounts.escrow.amount
            .checked_add(rent)
            .ok_or(AppMarketError::MathOverflow)?;
        require!(
            escrow_balance >= tracked_with_rent,
            AppMarketError::EscrowBalanceMismatch
        );

        // Transfer funds
        let seeds = &[
            b"escrow",
            ctx.accounts.listing.to_account_info().key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer = &[&seeds[..]];

        // Platform fee to treasury
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, transaction.platform_fee)?;

        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(transaction.platform_fee)
            .ok_or(AppMarketError::MathOverflow)?;

        // Seller proceeds to seller
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, transaction.seller_proceeds)?;

        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(transaction.seller_proceeds)
            .ok_or(AppMarketError::MathOverflow)?;

        // Update transaction status
        transaction.status = TransactionStatus::Completed;
        transaction.completed_at = Some(clock.unix_timestamp);

        // SECURITY: Use saturating_add for stats (prevents overflow blocking transactions)
        let config = &mut ctx.accounts.config;
        config.total_volume = config.total_volume.saturating_add(transaction.sale_price);
        config.total_sales = config.total_sales.saturating_add(1);

        emit!(TransactionCompleted {
            transaction: transaction.key(),
            seller: transaction.seller,
            buyer: transaction.buyer,
            amount: transaction.sale_price,
            platform_fee: transaction.platform_fee,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Open a dispute
    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        reason: String,
    ) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let dispute = &mut ctx.accounts.dispute;
        let clock = Clock::get()?;

        // Validations
        require!(transaction.status == TransactionStatus::InEscrow, AppMarketError::InvalidTransactionStatus);
        require!(
            ctx.accounts.initiator.key() == transaction.buyer ||
            ctx.accounts.initiator.key() == transaction.seller,
            AppMarketError::NotPartyToTransaction
        );
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );

        // SECURITY: Pre-check initiator has sufficient balance for dispute fee
        let dispute_fee = transaction.sale_price
            .checked_mul(ctx.accounts.config.dispute_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(AppMarketError::MathOverflow)?;

        require!(
            ctx.accounts.initiator.lamports() >= dispute_fee,
            AppMarketError::InsufficientBalance
        );

        // Charge dispute fee from initiator
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.initiator.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, dispute_fee)?;

        // Update transaction status
        transaction.status = TransactionStatus::Disputed;

        // Create dispute record
        dispute.transaction = transaction.key();
        dispute.initiator = ctx.accounts.initiator.key();
        dispute.respondent = if ctx.accounts.initiator.key() == transaction.buyer {
            transaction.seller
        } else {
            transaction.buyer
        };
        dispute.reason = reason.clone();
        dispute.status = DisputeStatus::Open;
        dispute.created_at = clock.unix_timestamp;
        dispute.dispute_fee = dispute_fee;
        dispute.bump = ctx.bumps.dispute;

        emit!(DisputeOpened {
            dispute: dispute.key(),
            transaction: transaction.key(),
            initiator: dispute.initiator,
            reason,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Resolve dispute (admin only)
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        resolution: DisputeResolution,
        notes: String,
    ) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let dispute = &mut ctx.accounts.dispute;
        let clock = Clock::get()?;

        // Validations
        require!(ctx.accounts.admin.key() == ctx.accounts.config.admin, AppMarketError::NotAdmin);
        require!(dispute.status == DisputeStatus::Open || dispute.status == DisputeStatus::UnderReview, AppMarketError::DisputeNotOpen);
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );
        require!(
            ctx.accounts.buyer.key() == transaction.buyer,
            AppMarketError::InvalidBuyer
        );
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::InvalidSeller
        );

        // SECURITY: Validate escrow balance before any transfers
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.escrow.to_account_info().data_len()
        );

        let seeds = &[
            b"escrow",
            ctx.accounts.listing.to_account_info().key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer = &[&seeds[..]];

        match resolution {
            DisputeResolution::FullRefund => {
                require!(
                    escrow_balance >= transaction.sale_price + rent,
                    AppMarketError::InsufficientEscrowBalance
                );

                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.buyer.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, transaction.sale_price)?;

                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(transaction.sale_price)
                    .ok_or(AppMarketError::MathOverflow)?;

                transaction.status = TransactionStatus::Refunded;
            },
            DisputeResolution::ReleaseToSeller => {
                let required_balance = transaction.platform_fee
                    .checked_add(transaction.seller_proceeds)
                    .ok_or(AppMarketError::MathOverflow)?;
                require!(
                    escrow_balance >= required_balance + rent,
                    AppMarketError::InsufficientEscrowBalance
                );

                // Platform fee to treasury
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, transaction.platform_fee)?;

                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(transaction.platform_fee)
                    .ok_or(AppMarketError::MathOverflow)?;

                // Seller proceeds
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.seller.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, transaction.seller_proceeds)?;

                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(transaction.seller_proceeds)
                    .ok_or(AppMarketError::MathOverflow)?;

                transaction.status = TransactionStatus::Completed;
            },
            DisputeResolution::PartialRefund { buyer_amount, seller_amount } => {
                let total_refund = buyer_amount
                    .checked_add(seller_amount)
                    .ok_or(AppMarketError::MathOverflow)?;
                require!(
                    total_refund <= transaction.sale_price,
                    AppMarketError::InvalidRefundAmounts
                );
                require!(
                    escrow_balance >= total_refund + rent,
                    AppMarketError::InsufficientEscrowBalance
                );

                // Transfer to buyer
                if buyer_amount > 0 {
                    let cpi_ctx = CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.escrow.to_account_info(),
                            to: ctx.accounts.buyer.to_account_info(),
                        },
                        signer,
                    );
                    anchor_lang::system_program::transfer(cpi_ctx, buyer_amount)?;

                    ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                        .checked_sub(buyer_amount)
                        .ok_or(AppMarketError::MathOverflow)?;
                }

                // Transfer to seller
                if seller_amount > 0 {
                    let cpi_ctx = CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.escrow.to_account_info(),
                            to: ctx.accounts.seller.to_account_info(),
                        },
                        signer,
                    );
                    anchor_lang::system_program::transfer(cpi_ctx, seller_amount)?;

                    ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                        .checked_sub(seller_amount)
                        .ok_or(AppMarketError::MathOverflow)?;
                }

                // Remainder to treasury
                let remaining = transaction.sale_price
                    .checked_sub(total_refund)
                    .ok_or(AppMarketError::MathOverflow)?;
                if remaining > 0 {
                    let cpi_ctx = CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::Transfer {
                            from: ctx.accounts.escrow.to_account_info(),
                            to: ctx.accounts.treasury.to_account_info(),
                        },
                        signer,
                    );
                    anchor_lang::system_program::transfer(cpi_ctx, remaining)?;

                    ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                        .checked_sub(remaining)
                        .ok_or(AppMarketError::MathOverflow)?;
                }

                transaction.status = TransactionStatus::Completed;
            },
        }

        // Update dispute
        dispute.status = DisputeStatus::Resolved;
        dispute.resolution = Some(resolution);
        dispute.resolution_notes = Some(notes.clone());
        dispute.resolved_at = Some(clock.unix_timestamp);

        emit!(DisputeResolved {
            dispute: dispute.key(),
            transaction: transaction.key(),
            resolution,
            notes,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Emergency refund after transfer deadline passes (ONLY if seller never confirmed transfer)
    pub fn emergency_refund(ctx: Context<EmergencyRefund>) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // Validations
        require!(
            transaction.status == TransactionStatus::InEscrow,
            AppMarketError::InvalidTransactionStatus
        );
        require!(
            ctx.accounts.buyer.key() == transaction.buyer,
            AppMarketError::NotBuyer
        );
        require!(
            clock.unix_timestamp > transaction.transfer_deadline,
            AppMarketError::DeadlineNotPassed
        );

        // SECURITY: If seller confirmed transfer, buyer MUST open dispute
        if transaction.seller_confirmed_transfer {
            return Err(AppMarketError::MustOpenDispute.into());
        }

        // SECURITY: Validate escrow balance
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.escrow.to_account_info().data_len()
        );
        require!(
            escrow_balance >= transaction.sale_price + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // Validate tracked amount
        let tracked_with_rent = ctx.accounts.escrow.amount
            .checked_add(rent)
            .ok_or(AppMarketError::MathOverflow)?;
        require!(
            escrow_balance >= tracked_with_rent,
            AppMarketError::EscrowBalanceMismatch
        );

        // Refund full amount to buyer
        let seeds = &[
            b"escrow",
            ctx.accounts.listing.to_account_info().key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.buyer.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, transaction.sale_price)?;

        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(transaction.sale_price)
            .ok_or(AppMarketError::MathOverflow)?;

        transaction.status = TransactionStatus::Refunded;
        transaction.completed_at = Some(clock.unix_timestamp);

        emit!(TransactionCompleted {
            transaction: transaction.key(),
            seller: transaction.seller,
            buyer: transaction.buyer,
            amount: 0,
            platform_fee: 0,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Cancel listing (seller only, before any bids)
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;

        // Validations
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(ctx.accounts.seller.key() == listing.seller, AppMarketError::NotSeller);
        require!(listing.current_bidder.is_none(), AppMarketError::HasBids);

        listing.status = ListingStatus::Cancelled;

        emit!(AuctionCancelled {
            listing: listing.key(),
            reason: "Cancelled by seller".to_string(),
        });

        Ok(())
    }
}

// ============================================
// ACCOUNTS
// ============================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + MarketConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, MarketConfig>,

    /// CHECK: Treasury wallet to receive fees
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeTreasuryChange<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteTreasuryChange<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProposeAdminChange<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteAdminChange<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(salt: u64)]
pub struct CreateListing<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", seller.key().as_ref(), &salt.to_le_bytes()],
        bump
    )]
    pub listing: Account<'info, Listing>,

    // SECURITY: Initialize escrow atomically with listing (seller pays rent)
    #[account(
        init,
        payer = seller,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", listing.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    // SECURITY: Escrow must already exist (no init_if_needed race condition)
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    /// CHECK: Previous bidder to refund (validated in instruction)
    #[account(mut)]
    pub previous_bidder: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyNow<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    // SECURITY: Escrow must already exist
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [b"transaction", listing.key().as_ref()],
        bump
    )]
    pub transaction: Account<'info, Transaction>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Previous bidder to refund
    #[account(mut)]
    pub previous_bidder: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleAuction<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = payer,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [b"transaction", listing.key().as_ref()],
        bump
    )]
    pub transaction: Account<'info, Transaction>,

    /// CHECK: Current bidder (validated in instruction)
    #[account(mut)]
    pub bidder: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellerConfirmTransfer<'info> {
    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    pub listing: Account<'info, Listing>,

    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmReceipt<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub listing: Account<'info, Listing>,

    // SECURITY: Close escrow and transaction accounts, return rent
    #[account(
        mut,
        close = seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = buyer,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller to receive funds
    #[account(mut)]
    pub seller: AccountInfo<'info>,

    /// CHECK: Treasury to receive fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    pub listing: Account<'info, Listing>,

    #[account(
        init,
        payer = initiator,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", transaction.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    /// CHECK: Treasury to receive dispute fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub listing: Account<'info, Listing>,

    // SECURITY: Close escrow, transaction, and dispute accounts
    #[account(
        mut,
        close = buyer,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = seller,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    #[account(
        mut,
        close = admin,
        seeds = [b"dispute", transaction.key().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub admin: Signer<'info>,

    /// CHECK: Buyer
    #[account(mut)]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Seller
    #[account(mut)]
    pub seller: AccountInfo<'info>,

    /// CHECK: Treasury
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EmergencyRefund<'info> {
    pub listing: Account<'info, Listing>,

    // SECURITY: Close escrow and transaction, return rent
    #[account(
        mut,
        close = buyer,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = buyer,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub admin: Signer<'info>,
}

// ============================================
// STATE
// ============================================

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub platform_fee_bps: u64,
    pub dispute_fee_bps: u64,
    pub total_volume: u64,
    pub total_sales: u64,
    pub paused: bool,
    // SECURITY: Admin timelock fields
    pub pending_treasury: Option<Pubkey>,
    pub pending_treasury_at: Option<i64>,
    pub pending_admin: Option<Pubkey>,
    pub pending_admin_at: Option<i64>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    #[max_len(64)]
    pub listing_id: String,
    pub starting_price: u64,
    pub reserve_price: Option<u64>,
    pub buy_now_price: Option<u64>,
    pub current_bid: u64,
    pub current_bidder: Option<Pubkey>,
    pub start_time: i64,
    pub end_time: i64,
    pub status: ListingStatus,
    // SECURITY: Lock fees at listing creation
    pub platform_fee_bps: u64,
    pub dispute_fee_bps: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub listing: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Transaction {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub sale_price: u64,
    pub platform_fee: u64,
    pub seller_proceeds: u64,
    pub status: TransactionStatus,
    pub transfer_deadline: i64,
    pub created_at: i64,
    // SECURITY: Seller confirmation fields
    pub seller_confirmed_transfer: bool,
    pub seller_confirmed_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    pub transaction: Pubkey,
    pub initiator: Pubkey,
    pub respondent: Pubkey,
    #[max_len(500)]
    pub reason: String,
    pub status: DisputeStatus,
    pub resolution: Option<DisputeResolution>,
    #[max_len(1000)]
    pub resolution_notes: Option<String>,
    pub dispute_fee: u64,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub bump: u8,
}

// ============================================
// ENUMS
// ============================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum TransactionStatus {
    Pending,
    InEscrow,
    Completed,
    Disputed,
    Refunded,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum DisputeStatus {
    Open,
    UnderReview,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum DisputeResolution {
    FullRefund,
    ReleaseToSeller,
    PartialRefund { buyer_amount: u64, seller_amount: u64 },
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub listing_id: String,
    pub starting_price: u64,
    pub end_time: i64,
    pub platform_fee_bps: u64,
}

#[event]
pub struct BidPlaced {
    pub listing: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct SaleCompleted {
    pub listing: Pubkey,
    pub transaction: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct SellerConfirmedTransfer {
    pub transaction: Pubkey,
    pub seller: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TransactionCompleted {
    pub transaction: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuctionCancelled {
    pub listing: Pubkey,
    pub reason: String,
}

#[event]
pub struct DisputeOpened {
    pub dispute: Pubkey,
    pub transaction: Pubkey,
    pub initiator: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute: Pubkey,
    pub transaction: Pubkey,
    pub resolution: DisputeResolution,
    pub notes: String,
    pub timestamp: i64,
}

#[event]
pub struct ContractPausedEvent {
    pub paused: bool,
    pub timestamp: i64,
}

#[event]
pub struct TreasuryChangeProposed {
    pub old_treasury: Pubkey,
    pub new_treasury: Pubkey,
    pub executable_at: i64,
}

#[event]
pub struct TreasuryChanged {
    pub new_treasury: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminChangeProposed {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub executable_at: i64,
}

#[event]
pub struct AdminChanged {
    pub new_admin: Pubkey,
    pub timestamp: i64,
}

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum AppMarketError {
    #[msg("Invalid price: must be greater than 0")]
    InvalidPrice,
    #[msg("Invalid duration: must be between 1 second and 30 days")]
    InvalidDuration,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Auction has not ended yet")]
    AuctionNotEnded,
    #[msg("Bid is too low")]
    BidTooLow,
    #[msg("Seller cannot bid on their own listing")]
    SellerCannotBid,
    #[msg("Seller cannot buy their own listing")]
    SellerCannotBuy,
    #[msg("Buy now is not enabled for this listing")]
    BuyNowNotEnabled,
    #[msg("Invalid transaction status")]
    InvalidTransactionStatus,
    #[msg("Only the buyer can confirm receipt")]
    NotBuyer,
    #[msg("Only the seller can perform this action")]
    NotSeller,
    #[msg("Only admin can perform this action")]
    NotAdmin,
    #[msg("Not a party to this transaction")]
    NotPartyToTransaction,
    #[msg("Dispute is not open")]
    DisputeNotOpen,
    #[msg("Listing has bids and cannot be cancelled")]
    HasBids,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Invalid previous bidder address")]
    InvalidPreviousBidder,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Invalid seller address")]
    InvalidSeller,
    #[msg("Invalid buyer address")]
    InvalidBuyer,
    #[msg("Invalid bidder address")]
    InvalidBidder,
    #[msg("Insufficient escrow balance")]
    InsufficientEscrowBalance,
    #[msg("Escrow tracked amount doesn't match actual balance")]
    EscrowBalanceMismatch,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Invalid refund amounts: total exceeds sale price")]
    InvalidRefundAmounts,
    #[msg("Unauthorized settlement: only seller, winner, or admin can settle")]
    UnauthorizedSettlement,
    #[msg("Bid increment too small: must be at least 5% or 0.1 SOL")]
    BidIncrementTooSmall,
    #[msg("Contract is paused")]
    ContractPaused,
    #[msg("Fee too high: platform fee capped at 10%, dispute fee at 5%")]
    FeeTooHigh,
    #[msg("No pending change to execute")]
    NoPendingChange,
    #[msg("Timelock has not expired: must wait 48 hours")]
    TimelockNotExpired,
    #[msg("Seller has confirmed transfer: buyer must open dispute if there's an issue")]
    MustOpenDispute,
    #[msg("Transfer already confirmed by seller")]
    AlreadyConfirmed,
}
