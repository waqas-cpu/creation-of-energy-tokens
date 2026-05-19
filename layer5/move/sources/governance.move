/// Post-deploy governance: UpgradeCap custody and treasury multisig checks.
module energy_settlement::governance {
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_settlement::l5_errors;

    /// Holds expected multisig / DAO address for operational caps (off-chain enforced).
    public struct GovernanceConfig has key {
        id: UID,
        treasury_multisig: address,
        upgrade_authority: address,
    }

    public struct GovernanceConfigured has copy, drop {
        treasury_multisig: address,
        upgrade_authority: address,
    }

    public fun create_config(
        treasury_multisig: address,
        upgrade_authority: address,
        ctx: &mut TxContext,
    ): GovernanceConfig {
        assert!(treasury_multisig != @0x0, l5_errors::unauthorized());
        assert!(upgrade_authority != @0x0, l5_errors::unauthorized());
        GovernanceConfig {
            id: object::new(ctx),
            treasury_multisig,
            upgrade_authority,
        }
    }

    public fun share_config(config: GovernanceConfig) {
        transfer::share_object(config);
    }

    public fun assert_treasury_holder(config: &GovernanceConfig, holder: address) {
        assert!(holder == config.treasury_multisig, l5_errors::jurisdiction_mismatch());
    }

    public fun treasury_multisig(config: &GovernanceConfig): address {
        config.treasury_multisig
    }

    public fun upgrade_authority(config: &GovernanceConfig): address {
        config.upgrade_authority
    }

    public fun config_id(config: &GovernanceConfig): ID {
        object::id(config)
    }
}
