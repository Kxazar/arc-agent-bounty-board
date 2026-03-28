import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import solc from "solc";
import type { Abi } from "viem";

type SolcOutput = {
  contracts?: Record<string, Record<string, { abi: unknown; evm?: { bytecode?: { object?: string } } }>>;
  errors?: Array<{
    severity: "warning" | "error";
    formattedMessage: string;
  }>;
};

export type ArcBountyBoardArtifact = {
  contractName: "ArcBountyBoard";
  abi: Abi;
  bytecode: `0x${string}`;
};

export async function compileArcBountyBoard() {
  const workspaceRoot = process.cwd();
  const contractPath = path.join(workspaceRoot, "contracts", "src", "ArcBountyBoard.sol");
  const source = await readFile(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "ArcBountyBoard.sol": {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const messages = output.errors ?? [];
  const errors = messages.filter((entry) => entry.severity === "error");

  for (const message of messages) {
    const line = `[solc:${message.severity}] ${message.formattedMessage}`;

    if (message.severity === "error") {
      console.error(line);
    } else {
      console.warn(line);
    }
  }

  if (errors.length > 0) {
    throw new Error("Solidity compilation failed.");
  }

  const contract = output.contracts?.["ArcBountyBoard.sol"]?.ArcBountyBoard;

  if (!contract?.evm?.bytecode?.object) {
    throw new Error("Compiled bytecode for ArcBountyBoard was not found.");
  }

  const artifact: ArcBountyBoardArtifact = {
    contractName: "ArcBountyBoard",
    abi: contract.abi as Abi,
    bytecode: `0x${contract.evm.bytecode.object}`
  };

  const artifactsDir = path.join(workspaceRoot, "artifacts");
  const artifactPath = path.join(artifactsDir, "ArcBountyBoard.json");

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return {
    artifact,
    artifactPath
  };
}
