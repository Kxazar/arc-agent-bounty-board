// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockIdentityRegistry {
    mapping(uint256 => address) private _owners;

    function setOwner(uint256 agentId, address owner) external {
        _owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        address owner = _owners[agentId];
        require(owner != address(0), "missing agent");
        return owner;
    }
}
