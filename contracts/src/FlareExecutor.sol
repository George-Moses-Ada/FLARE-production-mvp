// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FlareVault} from "./FlareVault.sol";

contract FlareExecutor is Ownable, ReentrancyGuard {
    struct Flare {
        address creator;
        address token;
        address recipient;
        uint256 targetHolders;
        uint256 amount;
        uint64 expiresAt;
        bool cancelled;
        bool triggered;
        bool executed;
    }

    FlareVault public immutable vault;
    mapping(address => Flare) public flares;

    event Triggered(address indexed flare, uint256 holderCount);
    event Executed(address indexed flare, address indexed recipient, uint256 amount);
    event Cancelled(address indexed flare);

    constructor(address owner_, address vault_) Ownable(owner_) {
        vault = FlareVault(vault_);
    }

    function configure(
        address flare,
        address creator,
        address token,
        uint256 targetHolders,
        address recipient,
        uint256 amount,
        uint64 expiresAt
    ) external onlyOwner {
        require(flare != address(0) && creator != address(0) && token != address(0) && recipient != address(0), "BAD_ADDRESS");
        require(targetHolders > 0 && amount > 0, "BAD_CONFIG");
        flares[flare] = Flare(creator,token,recipient,targetHolders,amount,expiresAt,false,false,false);
    }

    function markTriggered(address flare, uint256 holderCount) external onlyOwner {
        Flare storage f = flares[flare];
        require(!f.cancelled && !f.executed, "INVALID_STATE");
        require(f.expiresAt == 0 || block.timestamp <= f.expiresAt, "EXPIRED");
        require(holderCount >= f.targetHolders, "THRESHOLD");
        f.triggered = true;
        emit Triggered(flare, holderCount);
    }

    function execute(address flare) external onlyOwner nonReentrant {
        Flare storage f = flares[flare];
        require(f.triggered && !f.executed && !f.cancelled, "NOT_READY");
        require(f.expiresAt == 0 || block.timestamp <= f.expiresAt, "EXPIRED");
        f.executed = true;
        vault.release(f.token, f.recipient, f.amount);
        emit Executed(flare,f.recipient,f.amount);
    }

    function cancel(address flare) external {
        Flare storage f = flares[flare];
        require(msg.sender == f.creator || msg.sender == owner(), "NOT_AUTHORIZED");
        require(!f.executed, "EXECUTED");
        f.cancelled = true;
        emit Cancelled(flare);
    }
}
