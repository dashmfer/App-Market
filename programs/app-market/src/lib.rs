use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("AppMkt1111111111111111111111111111111111111");

/// App Market Escrow Program
/// Handles secure escrow for marketplace transactions
/// 
/// Flow:
/// 1. Seller creates listing -> Listing PDA created
/// 2. Buyer places bid / buys now -> Escrow PDA created, funds locked
/// 3. Auction ends -> Winner determined
/// 4. Transfer period -> Seller transfers assets
/// 5. Buyer confirms -> Escrow releases to seller
/// 6. OR Dispute -> Admin resolves

#[program]
pub mod app_market {
    use super::*;

    /// Platform fee: 5% (500 basis points)
    pub const PLATFORM_FEE_BPS: u64 = 500;
    /// Dispute fee: 2% (200 basis points)
    pub const DISPUTE_FEE_BPS: u64 = 200;
    /// Transfer deadline: 7 days in seconds
    pub const TRANSFER_DEADLINE_SECONDS: i64 = 7 * 24 * 60 * 60;
    /// Minimum bid increment: 5% (500 basis points)
    pub const MIN_BID_INCREMENT_BPS: u64 = 500;
    /// Absolute minimum bid increment: 0.001 SOL (1,000,000 lamports)
    pub const MIN_BID_INCREMENT_LAMPORTS: u64 = 1_000_000;
    /// Anti-sniping window: 15 minutes before auction end
    pub const ANTI_SNIPE_WINDOW: i64 = 15 * 60;
    /// Extension time when bid placed in anti-snipe window
    pub const ANTI_SNIPE_EXTENSION: i64 = 15 * 60;

    /// Initialize the marketplace config (one-time setup)
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_fee_bps: u64,
        dispute_fee_bps: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.platform_fee_bps = platform_fee_bps;
        config.dispute_fee_bps = dispute_fee_bps;
        config.total_volume = 0;
        config.total_sales = 0;
        config.paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Set paused state (admin only)
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

    /// Create a new listing
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
        require!(duration_seconds > 0 && duration_seconds <= 30 * 24 * 60 * 60, AppMarketError::InvalidDuration);

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        listing.seller = ctx.accounts.seller.key();
        // SECURITY: Use seller + salt for unique, front-run resistant listing ID
        listing.listing_id = format!("{}-{}", ctx.accounts.seller.key(), salt);
        listing.starting_price = starting_price;
        listing.reserve_price = reserve_price;
        listing.buy_now_price = buy_now_price;
        listing.current_bid = 0;
        listing.current_bidder = None;
        listing.start_time = clock.unix_timestamp;
        listing.end_time = clock.unix_timestamp + duration_seconds;
        listing.status = ListingStatus::Active;
        listing.bump = ctx.bumps.listing;

        emit!(ListingCreated {
            listing: listing.key(),
            seller: listing.seller,
            listing_id: listing.listing_id.clone(),
            starting_price,
            end_time: listing.end_time,
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

        // SECURITY: Enforce minimum bid increment to prevent spam
        if listing.current_bid > 0 {
            // Calculate 5% increment
            let increment = listing.current_bid
                .checked_mul(MIN_BID_INCREMENT_BPS)
                .ok_or(AppMarketError::MathOverflow)?
                .checked_div(10000)
                .ok_or(AppMarketError::MathOverflow)?;

            // Use larger of percentage increment or absolute minimum
            let min_increment = increment.max(MIN_BID_INCREMENT_LAMPORTS);
            let min_bid = listing.current_bid
                .checked_add(min_increment)
                .ok_or(AppMarketError::MathOverflow)?;

            require!(amount >= min_bid, AppMarketError::BidIncrementTooSmall);
        } else {
            // First bid must meet starting price
            require!(amount >= listing.starting_price, AppMarketError::BidTooLow);
        }

        // Validate previous_bidder if refund needed
        if let Some(previous_bidder) = listing.current_bidder {
            if listing.current_bid > 0 {
                require!(
                    ctx.accounts.previous_bidder.key() == previous_bidder,
                    AppMarketError::InvalidPreviousBidder
                );
            }
        }

        // EFFECTS: Update state BEFORE external calls (reentrancy protection)
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;
        listing.current_bid = amount;
        listing.current_bidder = Some(ctx.accounts.bidder.key());

        // SECURITY: Anti-sniping - extend auction if bid placed near end
        if clock.unix_timestamp > listing.end_time - ANTI_SNIPE_WINDOW {
            listing.end_time = clock.unix_timestamp
                .checked_add(ANTI_SNIPE_EXTENSION)
                .ok_or(AppMarketError::MathOverflow)?;
        }

        // INTERACTIONS: External calls LAST
        // Transfer new bid to escrow
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        // Update escrow amount tracking
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_add(amount)
            .ok_or(AppMarketError::MathOverflow)?;

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

        // CHECKS: All validations first
        require!(listing.status == ListingStatus::Active, AppMarketError::ListingNotActive);
        require!(clock.unix_timestamp < listing.end_time, AppMarketError::AuctionEnded);
        require!(listing.buy_now_price.is_some(), AppMarketError::BuyNowNotEnabled);
        require!(ctx.accounts.buyer.key() != listing.seller, AppMarketError::SellerCannotBuy);

        let buy_now_price = listing.buy_now_price.unwrap();

        // Validate previous_bidder if refund needed
        if let Some(previous_bidder) = listing.current_bidder {
            if listing.current_bid > 0 {
                require!(
                    ctx.accounts.previous_bidder.key() == previous_bidder,
                    AppMarketError::InvalidPreviousBidder
                );
            }
        }

        // EFFECTS: Update state BEFORE external calls (reentrancy protection)
        let old_bid = listing.current_bid;
        let old_bidder = listing.current_bidder;
        listing.current_bid = buy_now_price;
        listing.current_bidder = Some(ctx.accounts.buyer.key());
        listing.status = ListingStatus::Sold;
        listing.end_time = clock.unix_timestamp; // End auction immediately

        // INTERACTIONS: External calls LAST
        // Transfer buy now amount to escrow
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, buy_now_price)?;

        // Update escrow amount tracking
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_add(buy_now_price)
            .ok_or(AppMarketError::MathOverflow)?;

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

                // Update escrow amount tracking
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

        // Safe math for fee calculation
        transaction.platform_fee = buy_now_price
            .checked_mul(ctx.accounts.config.platform_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(10000)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.seller_proceeds = buy_now_price
            .checked_sub(transaction.platform_fee)
            .ok_or(AppMarketError::MathOverflow)?;

        transaction.status = TransactionStatus::InEscrow;
        transaction.transfer_deadline = clock.unix_timestamp
            .checked_add(TRANSFER_DEADLINE_SECONDS)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.created_at = clock.unix_timestamp;
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

        // Check if reserve price was met (if set)
        if let Some(reserve) = listing.reserve_price {
            if listing.current_bid < reserve {
                // Reserve not met - refund bidder and cancel
                if let Some(_bidder) = listing.current_bidder {
                    if listing.current_bid > 0 {
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

        // Safe math for fee calculation
        transaction.platform_fee = listing.current_bid
            .checked_mul(ctx.accounts.config.platform_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(10000)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.seller_proceeds = listing.current_bid
            .checked_sub(transaction.platform_fee)
            .ok_or(AppMarketError::MathOverflow)?;

        transaction.status = TransactionStatus::InEscrow;
        transaction.transfer_deadline = clock.unix_timestamp
            .checked_add(TRANSFER_DEADLINE_SECONDS)
            .ok_or(AppMarketError::MathOverflow)?;
        transaction.created_at = clock.unix_timestamp;
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

    /// Buyer confirms receipt of all assets - releases escrow
    pub fn confirm_receipt(ctx: Context<ConfirmReceipt>) -> Result<()> {
        let transaction = &mut ctx.accounts.transaction;
        let clock = Clock::get()?;

        // Validations
        require!(transaction.status == TransactionStatus::InEscrow, AppMarketError::InvalidTransactionStatus);
        require!(ctx.accounts.buyer.key() == transaction.buyer, AppMarketError::NotBuyer);

        // CRITICAL: Validate treasury matches config
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );

        // CRITICAL: Validate seller matches transaction
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::InvalidSeller
        );

        // CRITICAL: Validate escrow has sufficient balance
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        let required_balance = transaction.platform_fee
            .checked_add(transaction.seller_proceeds)
            .ok_or(AppMarketError::MathOverflow)?;
        require!(
            escrow_balance >= required_balance,
            AppMarketError::InsufficientEscrowBalance
        );

        // Transfer platform fee to treasury
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

        // Update escrow amount tracking
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

        // Update escrow amount tracking
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(transaction.seller_proceeds)
            .ok_or(AppMarketError::MathOverflow)?;

        // Update transaction status
        transaction.status = TransactionStatus::Completed;
        transaction.completed_at = Some(clock.unix_timestamp);

        // Update config stats with safe math
        let config = &mut ctx.accounts.config;
        config.total_volume = config.total_volume
            .checked_add(transaction.sale_price)
            .ok_or(AppMarketError::MathOverflow)?;
        config.total_sales = config.total_sales
            .checked_add(1)
            .ok_or(AppMarketError::MathOverflow)?;

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

        // SECURITY: Validate treasury matches config
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );

        // Calculate dispute fee
        let dispute_fee = transaction.sale_price
            .checked_mul(ctx.accounts.config.dispute_fee_bps)
            .ok_or(AppMarketError::MathOverflow)?
            .checked_div(10000)
            .ok_or(AppMarketError::MathOverflow)?;

        // SECURITY: Charge dispute fee from initiator
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

        // CRITICAL: Validate treasury matches config
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.config.treasury,
            AppMarketError::InvalidTreasury
        );

        // CRITICAL: Validate buyer and seller match transaction
        require!(
            ctx.accounts.buyer.key() == transaction.buyer,
            AppMarketError::InvalidBuyer
        );
        require!(
            ctx.accounts.seller.key() == transaction.seller,
            AppMarketError::InvalidSeller
        );

        let seeds = &[
            b"escrow",
            ctx.accounts.listing.to_account_info().key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer = &[&seeds[..]];

        match resolution {
            DisputeResolution::FullRefund => {
                // Validate escrow has sufficient balance
                let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
                require!(
                    escrow_balance >= transaction.sale_price,
                    AppMarketError::InsufficientEscrowBalance
                );

                // Refund buyer entirely
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.buyer.to_account_info(),
                    },
                    signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, transaction.sale_price)?;

                // Update escrow amount tracking
                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(transaction.sale_price)
                    .ok_or(AppMarketError::MathOverflow)?;

                // Charge dispute fee to seller (deducted from future transactions or flagged)
                transaction.status = TransactionStatus::Refunded;
            },
            DisputeResolution::ReleaseToSeller => {
                // Validate escrow has sufficient balance
                let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
                let required_balance = transaction.platform_fee
                    .checked_add(transaction.seller_proceeds)
                    .ok_or(AppMarketError::MathOverflow)?;
                require!(
                    escrow_balance >= required_balance,
                    AppMarketError::InsufficientEscrowBalance
                );

                // Release to seller (minus fees)
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

                // Update escrow amount tracking
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

                // Update escrow amount tracking
                ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                    .checked_sub(transaction.seller_proceeds)
                    .ok_or(AppMarketError::MathOverflow)?;

                // Charge dispute fee to buyer
                transaction.status = TransactionStatus::Completed;
            },
            DisputeResolution::PartialRefund { buyer_amount, seller_amount } => {
                // CRITICAL: Validate amounts don't exceed sale price
                let total_refund = buyer_amount
                    .checked_add(seller_amount)
                    .ok_or(AppMarketError::MathOverflow)?;
                require!(
                    total_refund <= transaction.sale_price,
                    AppMarketError::InvalidRefundAmounts
                );

                // Validate escrow has sufficient balance
                let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
                require!(
                    escrow_balance >= total_refund,
                    AppMarketError::InsufficientEscrowBalance
                );

                // Partial resolution - transfer to buyer
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

                    // Update escrow amount tracking
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

                    // Update escrow amount tracking
                    ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
                        .checked_sub(seller_amount)
                        .ok_or(AppMarketError::MathOverflow)?;
                }

                // Transfer remainder to treasury as platform fee
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

                    // Update escrow amount tracking
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

    /// Emergency refund after transfer deadline passes
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

        // Validate escrow has sufficient balance
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        require!(
            escrow_balance >= transaction.sale_price,
            AppMarketError::InsufficientEscrowBalance
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

        // Update escrow amount tracking
        ctx.accounts.escrow.amount = ctx.accounts.escrow.amount
            .checked_sub(transaction.sale_price)
            .ok_or(AppMarketError::MathOverflow)?;

        // Update transaction status
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

    #[account(
        init_if_needed,
        payer = bidder,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", listing.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    /// CHECK: Previous bidder to refund
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
    
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", listing.key().as_ref()],
        bump
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
    
    /// CHECK: Current bidder
    #[account(mut)]
    pub bidder: AccountInfo<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmReceipt<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, MarketConfig>,
    
    pub listing: Account<'info, Listing>,
    
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        mut,
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
    
    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(
        mut,
        seeds = [b"transaction", listing.key().as_ref()],
        bump = transaction.bump
    )]
    pub transaction: Account<'info, Transaction>,
    
    #[account(
        mut,
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

    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
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

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum AppMarketError {
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Invalid duration")]
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
    #[msg("Insufficient escrow balance")]
    InsufficientEscrowBalance,
    #[msg("Deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Invalid refund amounts")]
    InvalidRefundAmounts,
    #[msg("Unauthorized settlement")]
    UnauthorizedSettlement,
    #[msg("Bid increment too small - must be at least 5% or 0.001 SOL")]
    BidIncrementTooSmall,
    #[msg("Contract is paused")]
    ContractPaused,
}
