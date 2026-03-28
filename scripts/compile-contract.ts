import { compileArcBountyBoard } from "./lib/compile-arc-bounty-board";

async function main() {
  const { artifact, artifactPath } = await compileArcBountyBoard();

  console.log(`Compiled ${artifact.contractName}`);
  console.log(`Artifact written to ${artifactPath}`);
  console.log(`Bytecode size: ${(artifact.bytecode.length - 2) / 2} bytes`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
