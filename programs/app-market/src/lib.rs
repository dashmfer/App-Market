use anchor_lang::prelude::*;

declare_id!("FMqnbWG4pExkkXQjbtAiPmEFfsdopMfYnEaRT5pjnetZ");

/// App Market Escrow Program
/// Handles secure escrow for marketplace transactions
///
/// Flow:
/// 1. Seller creates listing + escrow -> Both PDAs created atomically
/// 2. Buyer places bid / buys now / makes offer -> Funds locked in escrow/offer PDAs
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

    /// Finalize grace period: 7 days after seller confirmation
    pub const FINALIZE_GRACE_PERIOD: i64 = 7 * 24 * 60 * 60;

    /// Maximum bids per listing (prevents DoS via bid spam)
    pub const MAX_BIDS_PER_LISTING: u64 = 1000;
    /// Maximum total offers per listing (prevents DoS via offer spam)
    pub const MAX_OFFERS_PER_LISTING: u64 = 100;
    /// Maximum consecutive offers per buyer without being outbid
    pub const MAX_CONSECUTIVE_OFFERS: u64 = 10;

    // ============================================
    // INSTRUCTIONS
    // ============================================

    /// Initialize the marketplace config (one-time setup)
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_fee_bps: u64,
        dispute_fee_bps: u64,
        backend_authority: Pubkey,
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
        config.backend_authority = backend_authority;
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
        listing_type: ListingType,
        starting_price: u64,
        reserve_price: Option<u64>,
        buy_now_price: Option<u64>,
        duration_seconds: i64,
        requires_github: bool,
        required_github_username: String,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);
        require!(starting_price > 0, AppMarketError::InvalidPrice);
        require!(
            duration_seconds > 0 && duration_seconds <= MAX_AUCTION_DURATION_SECONDS,
            AppMarketError::InvalidDuration
        );

        // Validate listing type requirements
        match listing_type {
            ListingType::Auction => {
                // Auction with reserve: starting bid must equal reserve
                if let Some(reserve) = reserve_price {
                    require!(
                        starting_price == reserve,
                        AppMarketError::StartingPriceMustEqualReserve
                    );
                }
                // ENHANCEMENT: Auctions can have buy_now_price for instant purchase during bidding
                // If someone hits buy_now during auction, they win immediately
            },
            ListingType::BuyNow => {
                require!(
                    buy_now_price.is_some(),
                    AppMarketError::BuyNowPriceRequired
                );
                // Note: BuyNow can also have reserve_price for dual listing functionality
            },
        }

        // SECURITY: Validate GitHub username format if provided
        if requires_github && !required_github_username.is_empty() {
            require!(
                required_github_username.len() <= 64,
                AppMarketError::InvalidGithubUsername
            );
            require!(
                required_github_username.chars().all(|c| c.is_alphanumeric() || c == '-'),
                AppMarketError::InvalidGithubUsername
            );
        }

        let listing = &mut ctx.accounts.listing;
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Initialize listing
        listing.seller = ctx.accounts.seller.key();
        listing.listing_id = format!("{}-{}", ctx.accounts.seller.key(), salt);
        listing.listing_type = listing_type.clone();
        listing.starting_price = starting_price;
        listing.reserve_price = reserve_price;
        listing.buy_now_price = buy_now_price;
        listing.current_bid = 0;
        listing.current_bidder = None;
        listing.created_at = clock.unix_timestamp;

        // SECURITY: Auction timer doesn't start until reserve bid placed
        listing.auction_started = false;
        listing.auction_start_time = None;
        listing.end_time = clock.unix_timestamp + duration_seconds;
        listing.status = ListingStatus::Active;

        // SECURITY: Lock fees at listing creation time
        listing.platform_fee_bps = ctx.accounts.config.platform_fee_bps;
        listing.dispute_fee_bps = ctx.accounts.config.dispute_fee_bps;

        // GitHub requirements
        listing.requires_github = requires_github;
        listing.required_github_username = required_github_username;

        // Withdrawal counter for unique PDA seeds
        listing.withdrawal_count = 0;
        // Offer counter
        listing.offer_count = 0;
        // Consecutive offer tracking
        listing.last_offer_buyer = None;
        listing.consecutive_offer_count = 0;

        listing.bump = ctx.bumps.listing;

        // Initialize escrow (seller pays rent)
        escrow.listing = listing.key();
        escrow.amount = 0;
        escrow.bump = ctx.bumps.escrow;

        emit!(ListingCreated {
            listing: listing.key(),
            seller: listing.seller,
            listing_id: listing.listing_id.clone(),
            listing_type,
            starting_price,
            end_time: listing.end_time,
            platform_fee_bps: listing.platform_fee_bps,
        });

        Ok(())
    }

    /// Place a bid on a listing (uses withdrawal pattern for refunds)
    pub fn place_bid(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // CHECKS: All validations first
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(
            listing.listing_type == ListingType::Auction,
            AppMarketError::NotAnAuction
        );

        // Check auction timing
        if listing.auction_started {
            require!(
                clock.unix_timestamp < listing.end_time,
                AppMarketError::AuctionEnded
            );
        }

        require!(ctx.accounts.bidder.key() != listing.seller, AppMarketError::SellerCannotBid);

        // SECURITY: Pre-check bidder has exact amount needed for everything to perform tx
        // Need: bid amount + withdrawal PDA rent (if creating) + tx fees
        let tx_fee_buffer = 10_000; // 10k lamports buffer for transaction fees
        let rent = Rent::get()?;

        let required_balance = if listing.current_bidder.is_some() && listing.current_bid > 0 {
            // Need rent for withdrawal PDA creation + bid amount + tx fees
            let withdrawal_space = 8 + PendingWithdrawal::INIT_SPACE;
            let withdrawal_rent = rent.minimum_balance(withdrawal_space);
            amount
                .checked_add(withdrawal_rent)
                .ok_or(AppMarketError::MathOverflow)?
                .checked_add(tx_fee_buffer)
                .ok_or(AppMarketError::MathOverflow)?
        } else {
            // First bid - no withdrawal PDA needed, just bid + tx fees
            amount.checked_add(tx_fee_buffer).ok_or(AppMarketError::MathOverflow)?
        };

        require!(
            ctx.accounts.bidder.lamports() >= required_balance,
            AppMarketError::InsufficientBalance
        );

        // SECURITY: Prevent DoS via bid spam
        require!(
            listing.withdrawal_count < MAX_BIDS_PER_LISTING,
            AppMarketError::MaxBidsExceeded
        );

        // SECURITY: Reject bids below reserve (if auction hasn't started)
        if !listing.auction_started {
            if let Some(reserve) = listing.reserve_price {
                require!(amount >= reserve, AppMarketError::BidBelowReserve);
            }
        }

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

        // EFFECTS: Update state BEFORE external calls
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;

        listing.current_bid = amount;
        listing.current_bidder = Some(ctx.accounts.bidder.key());

        // Start auction timer if reserve price met (or no reserve)
        if !listing.auction_started {
            let reserve_met = if let Some(reserve) = listing.reserve_price {
                amount >= reserve
            } else {
                true
            };

            if reserve_met {
                listing.auction_started = true;
                listing.auction_start_time = Some(clock.unix_timestamp);
                listing.end_time = clock.unix_timestamp
                    .checked_add(listing.end_time - listing.created_at)
                    .ok_or(AppMarketError::MathOverflow)?;
            }
        }

        // Update escrow amount tracking BEFORE transfers
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_add(amount)
            .ok_or(AppMarketError::MathOverflow)?;

        // SECURITY: Anti-sniping - extend auction if bid placed near end (only if started)
        if listing.auction_started && clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
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

        // SECURITY: Use withdrawal pattern for refunds (prevents DoS, only create when needed)
        if let Some(previous_bidder) = old_bidder {
            if old_bid > 0 {
                // Increment withdrawal counter to prevent PDA collision
                listing.withdrawal_count = listing.withdrawal_count
                    .checked_add(1)
                    .ok_or(AppMarketError::MathOverflow)?;

                // Derive PDA and verify
                let withdrawal_seeds = &[
                    b"withdrawal",
                    listing.key().as_ref(),
                    &listing.withdrawal_count.to_le_bytes(),
                ];
                let (withdrawal_pda, bump) = Pubkey::find_program_address(
                    withdrawal_seeds,
                    ctx.program_id
                );

                require!(
                    withdrawal_pda == ctx.accounts.pending_withdrawal.key(),
                    AppMarketError::InvalidPreviousBidder
                );

                // Create the withdrawal account
                let rent = Rent::get()?;
                let space = 8 + PendingWithdrawal::INIT_SPACE;
                let lamports = rent.minimum_balance(space);

                anchor_lang::system_program::create_account(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::CreateAccount {
                            from: ctx.accounts.bidder.to_account_info(),
                            to: ctx.accounts.pending_withdrawal.to_account_info(),
                        },
                    ),
                    lamports,
                    space as u64,
                    ctx.program_id,
                )?;

                // Initialize withdrawal data
                let mut withdrawal_data = ctx.accounts.pending_withdrawal.try_borrow_mut_data()?;
                let mut withdrawal = PendingWithdrawal::try_from_slice(&vec![0u8; space])?;
                withdrawal.user = previous_bidder;
                withdrawal.listing = listing.key();
                withdrawal.amount = old_bid;
                withdrawal.withdrawal_id = listing.withdrawal_count;
                withdrawal.created_at = clock.unix_timestamp;
                withdrawal.bump = bump;

                withdrawal.try_serialize(&mut &mut withdrawal_data[..])?;

                emit!(WithdrawalCreated {
                    user: previous_bidder,
                    listing: listing.key(),
                    amount: old_bid,
                    withdrawal_id: listing.withdrawal_count,
                    timestamp: clock.unix_timestamp,
                });
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

    /// Withdraw funds from pending withdrawal (pull pattern)
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        let withdrawal = &ctx.accounts.pending_withdrawal;
        let clock = Clock::get()?;

        // CHECKS: Validate user
        require!(
            ctx.accounts.user.key() == withdrawal.user,
            AppMarketError::NotWithdrawalOwner
        );

        // SECURITY: Validate escrow balance
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.escrow.to_account_info().data_len()
        );
        require!(
            escrow_balance >= withdrawal.amount + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // INTERACTIONS: Transfer funds
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
                to: ctx.accounts.user.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, withdrawal.amount)?;

        // Update escrow tracking
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(withdrawal.amount)
            .ok_or(AppMarketError::MathOverflow)?;

        emit!(WithdrawalClaimed {
            user: withdrawal.user,
            listing: ctx.accounts.listing.key(),
            amount: withdrawal.amount,
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
        require!(clock.unix_timestamp < listing.end_time, AppMarketError::ListingExpired);
        require!(listing.buy_now_price.is_some(), AppMarketError::BuyNowNotEnabled);
        require!(ctx.accounts.buyer.key() != listing.seller, AppMarketError::SellerCannotBuy);

        let buy_now_price = listing.buy_now_price.unwrap();

        // SECURITY: Pre-check buyer has sufficient balance
        require!(
            ctx.accounts.buyer.lamports() >= buy_now_price,
            AppMarketError::InsufficientBalance
        );

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

        // SECURITY: Use withdrawal pattern for any existing bidder (only initialize if needed)
        if let Some(previous_bidder) = old_bidder {
            if old_bid > 0 {
                // Derive PDA and bump
                let withdrawal_seeds = &[
                    b"withdrawal",
                    listing.key().as_ref(),
                    previous_bidder.as_ref(),
                ];
                let (withdrawal_pda, bump) = Pubkey::find_program_address(
                    withdrawal_seeds,
                    ctx.program_id
                );

                require!(
                    withdrawal_pda == ctx.accounts.pending_withdrawal.key(),
                    AppMarketError::InvalidPreviousBidder
                );

                // Create the account
                let rent = Rent::get()?;
                let space = 8 + PendingWithdrawal::INIT_SPACE;
                let lamports = rent.minimum_balance(space);

                anchor_lang::system_program::create_account(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        anchor_lang::system_program::CreateAccount {
                            from: ctx.accounts.buyer.to_account_info(),
                            to: ctx.accounts.pending_withdrawal.to_account_info(),
                        },
                    ),
                    lamports,
                    space as u64,
                    ctx.program_id,
                )?;

                // Initialize the withdrawal data
                let mut withdrawal_data = ctx.accounts.pending_withdrawal.try_borrow_mut_data()?;
                let mut withdrawal = PendingWithdrawal::try_from_slice(&vec![0u8; space])?;
                withdrawal.user = previous_bidder;
                withdrawal.listing = listing.key();
                withdrawal.amount = old_bid;
                withdrawal.created_at = clock.unix_timestamp;
                withdrawal.bump = bump;

                withdrawal.try_serialize(&mut &mut withdrawal_data[..])?;

                emit!(WithdrawalCreated {
                    user: previous_bidder,
                    listing: listing.key(),
                    amount: old_bid,
                    timestamp: clock.unix_timestamp,
                });
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

        // SECURITY: Fix validation order - check bidder validity FIRST
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(
            listing.listing_type == ListingType::Auction,
            AppMarketError::NotAnAuction
        );

        // Only require auction to be ended if it was started
        if listing.auction_started {
            require!(
                clock.unix_timestamp >= listing.end_time,
                AppMarketError::AuctionNotEnded
            );
        }

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

        // SECURITY: Must have bids to settle - use cancel_auction for no-bid scenarios
        require!(
            listing.current_bidder.is_some(),
            AppMarketError::NoBidsToSettle
        );

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

    /// Cancel auction (when no bids received, closes escrow and refunds rent)
    pub fn cancel_auction(ctx: Context<CancelAuction>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Validations
        require!(
            listing.status == ListingStatus::Active,
            AppMarketError::ListingNotActive
        );
        require!(
            listing.listing_type == ListingType::Auction,
            AppMarketError::NotAnAuction
        );
        require!(
            ctx.accounts.seller.key() == listing.seller,
            AppMarketError::NotSeller
        );

        // Can only cancel if:
        // 1. No bids received, OR
        // 2. Auction ended and reserve not met (auction_started = false means no valid bids)
        require!(
            listing.current_bidder.is_none(),
            AppMarketError::CannotCancelWithBids
        );

        // If auction has ended, require it to be past end_time
        if listing.auction_started {
            require!(
                clock.unix_timestamp >= listing.end_time,
                AppMarketError::AuctionNotEnded
            );
        }

        listing.status = ListingStatus::Cancelled;

        emit!(AuctionCancelled {
            listing: listing.key(),
            reason: "Cancelled by seller - no bids received".to_string(),
        });

        Ok(())
    }

    /// Expire listing (for buy-now listings that reached deadline)
    pub fn expire_listing(ctx: Context<ExpireListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Validations
        require!(
            listing.status == ListingStatus::Active,
            AppMarketError::ListingNotActive
        );
        require!(
            clock.unix_timestamp >= listing.end_time,
            AppMarketError::ListingNotExpired
        );
        require!(
            listing.current_bidder.is_none(),
            AppMarketError::HasBids
        );

        listing.status = ListingStatus::Expired;

        emit!(ListingExpired {
            listing: listing.key(),
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

    /// Backend service verifies uploads (GitHub repo, files, etc.)
    pub fn verify_uploads(
        ctx: Context<VerifyUploads>,
        verification_hash: String,
    ) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // SECURITY: Only backend authority can verify
        require!(
            ctx.accounts.backend_authority.key() == ctx.accounts.config.backend_authority,
            AppMarketError::NotBackendAuthority
        );

        require!(
            transaction.seller_confirmed_transfer,
            AppMarketError::SellerNotConfirmed
        );

        require!(
            !transaction.uploads_verified,
            AppMarketError::AlreadyVerified
        );

        transaction.uploads_verified = true;
        transaction.verification_timestamp = Some(clock.unix_timestamp);
        transaction.verification_hash = verification_hash.clone();

        emit!(UploadsVerified {
            transaction: transaction.key(),
            verification_hash,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Finalize transaction after grace period (7 days after seller confirmation)
    pub fn finalize_transaction(ctx: Context<FinalizeTransaction>) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // SECURITY: Only seller can call finalize
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::NotSeller
        );
        require!(
            ctx.accounts.seller.is_signer,
            AppMarketError::SellerMustSign
        );

        // Validations
        // SECURITY: Block finalization if disputed
        if transaction.status == TransactionStatus::Disputed {
            return Err(AppMarketError::CannotFinalizeDisputed.into());
        }

        require!(
            transaction.status == TransactionStatus::InEscrow,
            AppMarketError::InvalidTransactionStatus
        );

        require!(
            transaction.seller_confirmed_transfer,
            AppMarketError::SellerNotConfirmed
        );

        // SECURITY: Uploads must be verified
        require!(
            transaction.uploads_verified,
            AppMarketError::UploadsNotVerified
        );

        let confirmed_at = transaction.seller_confirmed_at.unwrap();
        require!(
            clock.unix_timestamp >= confirmed_at + FINALIZE_GRACE_PERIOD,
            AppMarketError::GracePeriodNotExpired
        );

        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );

        // SECURITY: Validate escrow balance
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.escrow.to_account_info().data_len()
        );

        let required_balance = transaction.platform_fee
            .checked_add(transaction.seller_proceeds)
            .ok_or(AppMarketError::MathOverflow)?;
        require!(
            escrow_balance >= required_balance + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // SECURITY: Verify tracked amount matches what we're distributing (prevents theft of pending withdrawals)
        require!(
            ctx.accounts.escrow.amount == required_balance,
            AppMarketError::PendingWithdrawalsExist
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

        // SECURITY: Use saturating_add for stats
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

        // SECURITY: Require upload verification before buyer can confirm receipt
        require!(
            transaction.uploads_verified,
            AppMarketError::UploadsNotVerified
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

        // SECURITY: Check no pending withdrawals before closing escrow (prevents theft)
        require!(
            ctx.accounts.escrow.amount == required_balance,
            AppMarketError::PendingWithdrawalsExist
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

    /// Make an offer on a listing
    pub fn make_offer(
        ctx: Context<MakeOffer>,
        amount: u64,
        deadline: i64,
        offer_seed: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Validations
        require!(
            listing.status == ListingStatus::Active,
            AppMarketError::ListingNotActive
        );
        require!(amount > 0, AppMarketError::InvalidPrice);
        require!(
            deadline > clock.unix_timestamp,
            AppMarketError::InvalidDeadline
        );
        require!(
            ctx.accounts.buyer.key() != listing.seller,
            AppMarketError::SellerCannotOffer
        );

        // SECURITY: Pre-check buyer has sufficient balance
        require!(
            ctx.accounts.buyer.lamports() >= amount,
            AppMarketError::InsufficientBalance
        );

        // SECURITY: Prevent DoS via total offer spam
        require!(
            listing.offer_count < MAX_OFFERS_PER_LISTING,
            AppMarketError::MaxOffersExceeded
        );

        // SECURITY: Check consecutive offers from same buyer (max 10 if no one else is outbidding)
        let buyer_key = ctx.accounts.buyer.key();
        if let Some(last_buyer) = listing.last_offer_buyer {
            if last_buyer == buyer_key {
                // Same buyer making consecutive offers
                require!(
                    listing.consecutive_offer_count < MAX_CONSECUTIVE_OFFERS,
                    AppMarketError::MaxConsecutiveOffersExceeded
                );
                // Increment consecutive counter
                listing.consecutive_offer_count = listing.consecutive_offer_count
                    .checked_add(1)
                    .ok_or(AppMarketError::MathOverflow)?;
            } else {
                // Different buyer - reset consecutive counter
                listing.last_offer_buyer = Some(buyer_key);
                listing.consecutive_offer_count = 1;
            }
        } else {
            // First offer on this listing
            listing.last_offer_buyer = Some(buyer_key);
            listing.consecutive_offer_count = 1;
        }

        // Increment total offer counter
        listing.offer_count = listing.offer_count
            .checked_add(1)
            .ok_or(AppMarketError::MathOverflow)?;

        // Initialize offer
        let offer = &mut ctx.accounts.offer;
        offer.listing = listing.key();
        offer.buyer = ctx.accounts.buyer.key();
        offer.amount = amount;
        offer.deadline = deadline;
        offer.status = OfferStatus::Active;
        offer.created_at = clock.unix_timestamp;
        offer.bump = ctx.bumps.offer;

        // Initialize escrow for offer
        let offer_escrow = &mut ctx.accounts.offer_escrow;
        offer_escrow.offer = offer.key();
        offer_escrow.amount = amount;
        offer_escrow.bump = ctx.bumps.offer_escrow;

        // Transfer funds to escrow
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.offer_escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        emit!(OfferCreated {
            offer: offer.key(),
            listing: listing.key(),
            buyer: ctx.accounts.buyer.key(),
            amount,
            deadline,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Cancel offer and get refund
    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        let clock = Clock::get()?;

        // Validations
        require!(
            ctx.accounts.buyer.key() == offer.buyer,
            AppMarketError::NotOfferOwner
        );
        require!(
            offer.status == OfferStatus::Active,
            AppMarketError::OfferNotActive
        );

        // Update offer status
        offer.status = OfferStatus::Cancelled;

        // Update consecutive offer tracking when buyer cancels
        let listing = &mut ctx.accounts.listing;
        if let Some(last_buyer) = listing.last_offer_buyer {
            if last_buyer == ctx.accounts.buyer.key() && listing.consecutive_offer_count > 0 {
                // Decrement the consecutive count since this buyer cancelled
                listing.consecutive_offer_count = listing.consecutive_offer_count.saturating_sub(1);
            }
        }

        // SECURITY: Validate escrow balance
        let escrow_balance = ctx.accounts.offer_escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.offer_escrow.to_account_info().data_len()
        );
        require!(
            escrow_balance >= offer.amount + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // Refund buyer (escrow will be closed, rent returned to buyer)
        let seeds = &[
            b"offer_escrow",
            offer.to_account_info().key.as_ref(),
            &[ctx.accounts.offer_escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.offer_escrow.to_account_info(),
                to: ctx.accounts.buyer.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, offer.amount)?;

        emit!(OfferCancelled {
            offer: offer.key(),
            listing: ctx.accounts.listing.key(),
            buyer: offer.buyer,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Claim expired offer refund
    /// Expire an offer after deadline (anyone can call, refund goes to buyer)
    pub fn expire_offer(ctx: Context<ExpireOffer>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        let clock = Clock::get()?;

        // Validations
        require!(
            offer.status == OfferStatus::Active,
            AppMarketError::OfferNotActive
        );
        require!(
            clock.unix_timestamp > offer.deadline,
            AppMarketError::OfferNotExpired
        );
        // SECURITY: Only offer owner (buyer) can expire their own offer
        require!(
            ctx.accounts.caller.key() == offer.buyer,
            AppMarketError::NotOfferOwner
        );

        // Update offer status
        offer.status = OfferStatus::Expired;

        // Update consecutive offer tracking when offer expires
        let listing = &mut ctx.accounts.listing;
        if let Some(last_buyer) = listing.last_offer_buyer {
            if last_buyer == offer.buyer && listing.consecutive_offer_count > 0 {
                // Decrement the consecutive count since this offer expired
                listing.consecutive_offer_count = listing.consecutive_offer_count.saturating_sub(1);
            }
        }

        // SECURITY: Validate escrow balance
        let escrow_balance = ctx.accounts.offer_escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.offer_escrow.to_account_info().data_len()
        );
        require!(
            escrow_balance >= offer.amount + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        // Refund buyer
        let seeds = &[
            b"offer_escrow",
            offer.to_account_info().key.as_ref(),
            &[ctx.accounts.offer_escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.offer_escrow.to_account_info(),
                to: ctx.accounts.buyer.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, offer.amount)?;

        emit!(OfferExpired {
            offer: offer.key(),
            listing: ctx.accounts.listing.key(),
            buyer: offer.buyer,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Accept offer (seller only)
    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        require!(!ctx.accounts.config.paused, AppMarketError::ContractPaused);

        let listing = &mut ctx.accounts.listing;
        let offer = &mut ctx.accounts.offer;
        let clock = Clock::get()?;

        // Validations
        require!(
            ctx.accounts.seller.key() == listing.seller,
            AppMarketError::NotSeller
        );
        require!(
            listing.status == ListingStatus::Active,
            AppMarketError::ListingNotActive
        );
        require!(
            offer.status == OfferStatus::Active,
            AppMarketError::OfferNotActive
        );
        require!(
            clock.unix_timestamp <= offer.deadline,
            AppMarketError::OfferExpired
        );

        // SECURITY: Store old values before updating
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;

        // Update statuses
        offer.status = OfferStatus::Accepted;
        listing.status = ListingStatus::Sold;
        listing.current_bid = offer.amount;
        listing.current_bidder = Some(offer.buyer);

        // Reset consecutive offer tracking since listing is now sold
        listing.last_offer_buyer = None;
        listing.consecutive_offer_count = 0;

        // Transfer funds from offer escrow to listing escrow
        let offer_escrow_balance = ctx.accounts.offer_escrow.to_account_info().lamports();
        let rent = Rent::get()?.minimum_balance(
            ctx.accounts.offer_escrow.to_account_info().data_len()
        );
        require!(
            offer_escrow_balance >= offer.amount + rent,
            AppMarketError::InsufficientEscrowBalance
        );

        let seeds = &[
            b"offer_escrow",
            offer.to_account_info().key.as_ref(),
            &[ctx.accounts.offer_escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.offer_escrow.to_account_info(),
                to: ctx.accounts.listing_escrow.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, offer.amount)?;

        // Update listing escrow tracking
        ctx.accounts.listing_escrow.amount = ctx.accounts.listing_escrow.amount
            .checked_add(offer.amount)
            .ok_or(AppMarketError::MathOverflow)?;

        // Handle any existing bidder with withdrawal pattern
        if let Some(previous_bidder) = old_bidder {
            if previous_bidder != offer.buyer && old_bid > 0 {
                // Increment withdrawal counter to prevent PDA collision
                listing.withdrawal_count = listing.withdrawal_count
                    .checked_add(1)
                    .ok_or(AppMarketError::MathOverflow)?;

                let withdrawal = &mut ctx.accounts.pending_withdrawal;
                withdrawal.user = previous_bidder;
                withdrawal.listing = listing.key();
                withdrawal.amount = old_bid;  // SECURITY: Use old bid amount
                withdrawal.withdrawal_id = listing.withdrawal_count;
                withdrawal.created_at = clock.unix_timestamp;
                withdrawal.bump = ctx.bumps.pending_withdrawal;

                emit!(WithdrawalCreated {
                    user: previous_bidder,
                    listing: listing.key(),
                    amount: old_bid,
                    withdrawal_id: listing.withdrawal_count,
                    timestamp: clock.unix_timestamp,
                });
            }
        }

        // Create transaction record
        let transaction = &mut ctx.accounts.transaction;
        transaction.listing = listing.key();
        transaction.seller = listing.seller;
        transaction.buyer = offer.buyer;
        transaction.sale_price = offer.amount;

        // SECURITY: Use LOCKED fees from listing
        transaction.platform_fee = offer.amount
            .checked_mul(listing.platform_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(BASIS_POINTS_DIVISOR)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.seller_proceeds = offer.amount
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

        emit!(OfferAccepted {
            offer: offer.key(),
            listing: listing.key(),
            transaction: transaction.key(),
            buyer: offer.buyer,
            seller: listing.seller,
            amount: offer.amount,
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

        // SECURITY: Buyers can dispute until the deadline
        // After deadline expires, they can no longer dispute and seller can finalize if uploads are verified

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

        // SECURITY: Hold dispute fee in Dispute PDA (refunded to buyer if they win)
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.initiator.to_account_info(),
                to: ctx.accounts.dispute.to_account_info(),
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
                // SECURITY: Validate no zero amounts
                require!(buyer_amount > 0 || seller_amount > 0, AppMarketError::InvalidRefundAmounts);

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

        // SECURITY: Distribute dispute fee based on resolution outcome
        let dispute_seeds = &[
            b"dispute",
            transaction.key().as_ref(),
            &[dispute.bump],
        ];
        let dispute_signer = &[&dispute_seeds[..]];

        match resolution {
            DisputeResolution::FullRefund => {
                // Buyer wins - refund dispute fee to buyer
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.dispute.to_account_info(),
                        to: ctx.accounts.buyer.to_account_info(),
                    },
                    dispute_signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, dispute.dispute_fee)?;
            },
            DisputeResolution::ReleaseToSeller | DisputeResolution::PartialRefund { .. } => {
                // Seller wins or compromise - send dispute fee to treasury
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.dispute.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    dispute_signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, dispute.dispute_fee)?;
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

        // SECURITY: Check no pending withdrawals before closing escrow (prevents theft)
        require!(
            ctx.accounts.escrow.amount == transaction.sale_price,
            AppMarketError::PendingWithdrawalsExist
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

        // SECURITY: Prevent cancellation if auction has started (has bids)
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
#[instruction(amount: u64)]
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

    // SECURITY: Pending withdrawal for previous bidder (only created when needed)
    /// CHECK: Only created if there's a previous bidder to refund
    #[account(mut)]
    pub pending_withdrawal: UncheckedAccount<'info>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    // SECURITY: Close withdrawal account and return rent to user
    // Uses withdrawal_id from PendingWithdrawal struct (not seeds - we look it up)
    #[account(
        mut,
        close = user,
        seeds = [
            b"withdrawal",
            listing.key().as_ref(),
            &pending_withdrawal.withdrawal_id.to_le_bytes()
        ],
        bump = pending_withdrawal.bump,
        constraint = pending_withdrawal.user == user.key() @ AppMarketError::NotWithdrawalOwner
    )]
    pub pending_withdrawal: Account<'info, PendingWithdrawal>,

    #[account(mut)]
    pub user: Signer<'info>,

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

    // SECURITY: Pending withdrawal for previous bidder (only initialized if previous bidder exists)
    /// CHECK: Only used if listing.current_bidder exists, manually initialized in instruction
    #[account(mut)]
    pub pending_withdrawal: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

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
pub struct CancelAuction<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    // SECURITY: Close escrow and refund rent to seller when auction cancelled (no bids)
    #[account(
        mut,
        close = seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExpireListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    // SECURITY: Close escrow when listing expires without bids
    #[account(
        mut,
        close = seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump,
        constraint = listing.seller == seller.key() @ AppMarketError::NotSeller
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Seller receives rent
    #[account(mut)]
    pub seller: AccountInfo<'info>,
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
pub struct VerifyUploads<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub transaction: Account<'info, Transaction>,

    /// Backend authority that verifies uploads
    pub backend_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeTransaction<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    // SECURITY: Close escrow - rent goes to seller (from transaction.seller, not unchecked AccountInfo)
    #[account(
        mut,
        close = transaction.seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Seller to receive funds (validated via transaction.seller)
    #[account(
        mut,
        constraint = seller.key() == transaction.seller @ AppMarketError::InvalidSeller
    )]
    pub seller: AccountInfo<'info>,

    /// CHECK: Buyer (not used for rent, just fund transfer)
    #[account(mut)]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Treasury to receive fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmReceipt<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    // SECURITY: Close escrow - rent goes to seller (from transaction.seller)
    #[account(
        mut,
        close = transaction.seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller to receive funds (validated via transaction.seller)
    #[account(
        mut,
        constraint = seller.key() == transaction.seller @ AppMarketError::InvalidSeller
    )]
    pub seller: AccountInfo<'info>,

    /// CHECK: Treasury to receive fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, deadline: i64, offer_seed: u64)]
pub struct MakeOffer<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    pub listing: Account<'info, Listing>,

    // SECURITY: Use deterministic offer_seed instead of Clock::get() to prevent consensus issues
    #[account(
        init,
        payer = buyer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [
            b"offer",
            listing.key().as_ref(),
            buyer.key().as_ref(),
            &offer_seed.to_le_bytes()
        ],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init,
        payer = buyer,
        space = 8 + OfferEscrow::INIT_SPACE,
        seeds = [b"offer_escrow", offer.key().as_ref()],
        bump
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub offer: Account<'info, Offer>,

    // SECURITY: Close escrow and return rent to buyer
    #[account(
        mut,
        close = buyer,
        seeds = [b"offer_escrow", offer.key().as_ref()],
        bump = offer_escrow.bump
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExpireOffer<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub offer: Account<'info, Offer>,

    // SECURITY: Close escrow and return rent to buyer
    #[account(
        mut,
        close = buyer,
        seeds = [b"offer_escrow", offer.key().as_ref()],
        bump = offer_escrow.bump
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    /// Buyer receives refund (from offer.buyer, not caller)
    #[account(
        mut,
        constraint = buyer.key() == offer.buyer @ AppMarketError::InvalidBuyer
    )]
    pub buyer: SystemAccount<'info>,

    /// Caller pays gas (can be anyone)
    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub offer: Account<'info, Offer>,

    // Transfer funds from offer escrow to listing escrow
    #[account(
        mut,
        close = buyer,
        seeds = [b"offer_escrow", offer.key().as_ref()],
        bump = offer_escrow.bump,
        constraint = offer.buyer == buyer.key() @ AppMarketError::InvalidBuyer
    )]
    pub offer_escrow: Account<'info, OfferEscrow>,

    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = listing_escrow.bump
    )]
    pub listing_escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = seller,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [b"transaction", listing.key().as_ref()],
        bump
    )]
    pub transaction: Account<'info, Transaction>,

    // Pending withdrawal for previous bidder if exists
    #[account(
        init,
        payer = seller,
        space = 8 + PendingWithdrawal::INIT_SPACE,
        seeds = [
            b"withdrawal",
            listing.key().as_ref(),
            &(listing.withdrawal_count + 1).to_le_bytes()
        ],
        bump
    )]
    pub pending_withdrawal: Account<'info, PendingWithdrawal>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Buyer - rent recipient for offer escrow
    #[account(mut)]
    pub buyer: AccountInfo<'info>,

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

    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,

    // SECURITY: Close escrow - rent goes to seller (seller paid escrow rent during listing creation)
    #[account(
        mut,
        close = transaction.seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        close = admin,
        seeds = [b"dispute", transaction.key().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub admin: Signer<'info>,

    /// CHECK: Buyer (validated via transaction.buyer)
    #[account(
        mut,
        constraint = buyer.key() == transaction.buyer @ AppMarketError::InvalidBuyer
    )]
    pub buyer: AccountInfo<'info>,

    /// CHECK: Seller (validated via transaction.seller)
    #[account(
        mut,
        constraint = seller.key() == transaction.seller @ AppMarketError::InvalidSeller
    )]
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

    // SECURITY: Close escrow when cancelling (rent returns to seller)
    #[account(
        mut,
        close = seller,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
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
    pub backend_authority: Pubkey,  // For verifying uploads
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
    pub listing_type: ListingType,
    pub starting_price: u64,
    pub reserve_price: Option<u64>,
    pub buy_now_price: Option<u64>,
    pub current_bid: u64,
    pub current_bidder: Option<Pubkey>,
    pub created_at: i64,
    // SECURITY: Auction timing fields
    pub auction_started: bool,
    pub auction_start_time: Option<i64>,
    pub end_time: i64,
    pub status: ListingStatus,
    // SECURITY: Lock fees at listing creation
    pub platform_fee_bps: u64,
    pub dispute_fee_bps: u64,
    // GitHub requirements
    pub requires_github: bool,
    #[max_len(64)]
    pub required_github_username: String,
    // Withdrawal counter for unique PDA seeds
    pub withdrawal_count: u64,
    // Offer counter for tracking total offers
    pub offer_count: u64,
    // Track consecutive offers from same buyer
    pub last_offer_buyer: Option<Pubkey>,
    pub consecutive_offer_count: u64,
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
    // Upload verification
    pub uploads_verified: bool,
    pub verification_timestamp: Option<i64>,
    #[max_len(64)]
    pub verification_hash: String,
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

#[account]
#[derive(InitSpace)]
pub struct PendingWithdrawal {
    pub user: Pubkey,
    pub listing: Pubkey,
    pub amount: u64,
    pub withdrawal_id: u64,  // Unique ID from listing.withdrawal_count
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub deadline: i64,
    pub status: OfferStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OfferEscrow {
    pub offer: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

// ============================================
// ENUMS
// ============================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ListingType {
    Auction,
    BuyNow,
}

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum OfferStatus {
    Active,
    Accepted,
    Cancelled,
    Expired,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub listing_id: String,
    pub listing_type: ListingType,
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
pub struct UploadsVerified {
    pub transaction: Pubkey,
    pub verification_hash: String,
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
pub struct ListingExpired {
    pub listing: Pubkey,
    pub timestamp: i64,
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

#[event]
pub struct WithdrawalCreated {
    pub user: Pubkey,
    pub listing: Pubkey,
    pub amount: u64,
    pub withdrawal_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalClaimed {
    pub user: Pubkey,
    pub listing: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct OfferCreated {
    pub offer: Pubkey,
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub deadline: i64,
    pub timestamp: i64,
}

#[event]
pub struct OfferCancelled {
    pub offer: Pubkey,
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct OfferExpired {
    pub offer: Pubkey,
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct OfferAccepted {
    pub offer: Pubkey,
    pub listing: Pubkey,
    pub transaction: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
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
    #[msg("Listing has expired")]
    ListingExpired,
    #[msg("Listing has not expired yet")]
    ListingNotExpired,
    #[msg("Bid is too low")]
    BidTooLow,
    #[msg("Seller cannot bid on their own listing")]
    SellerCannotBid,
    #[msg("Seller cannot buy their own listing")]
    SellerCannotBuy,
    #[msg("Seller cannot make offers on their own listing")]
    SellerCannotOffer,
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
    #[msg("Invalid refund amounts: total exceeds sale price or both amounts are zero")]
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
    #[msg("Not the owner of this withdrawal")]
    NotWithdrawalOwner,
    #[msg("Not the owner of this offer")]
    NotOfferOwner,
    #[msg("Offer is not active")]
    OfferNotActive,
    #[msg("Offer has expired")]
    OfferExpired,
    #[msg("Offer has not expired yet")]
    OfferNotExpired,
    #[msg("Invalid deadline: must be in the future")]
    InvalidDeadline,
    #[msg("This is not an auction listing")]
    NotAnAuction,
    #[msg("Seller has not confirmed transfer yet")]
    SellerNotConfirmed,
    #[msg("Grace period has not expired: must wait 72 hours after seller confirmation")]
    GracePeriodNotExpired,
    #[msg("Starting price must equal reserve price for reserve auctions")]
    StartingPriceMustEqualReserve,
    #[msg("Buy now price is required for BuyNow listings")]
    BuyNowPriceRequired,
    #[msg("Uploads not verified by backend")]
    UploadsNotVerified,
    #[msg("Uploads already verified")]
    AlreadyVerified,
    #[msg("Not backend authority")]
    NotBackendAuthority,
    #[msg("Bid below reserve price")]
    BidBelowReserve,
    #[msg("Cannot finalize disputed transaction")]
    CannotFinalizeDisputed,
    #[msg("Seller must sign to finalize")]
    SellerMustSign,
    #[msg("No bids to settle - use cancel_auction instead")]
    NoBidsToSettle,
    #[msg("Cannot cancel auction with active bids")]
    CannotCancelWithBids,
    #[msg("Cannot close escrow: pending withdrawals exist")]
    PendingWithdrawalsExist,
    #[msg("Invalid GitHub username: must be 64 chars or less, alphanumeric and hyphens only")]
    InvalidGithubUsername,
    #[msg("Dispute deadline expired: must dispute within grace period")]
    DisputeDeadlineExpired,
    #[msg("Maximum bids per listing exceeded")]
    MaxBidsExceeded,
    #[msg("Maximum offers per listing exceeded")]
    MaxOffersExceeded,
    #[msg("Maximum consecutive offers from same buyer exceeded (max 10 without being outbid)")]
    MaxConsecutiveOffersExceeded,
}
