import { BountyBoardApp } from "@/components/bounty-board-app";

import { Providers } from "./providers";

export default function HomePage() {
  return (
    <Providers>
      <BountyBoardApp />
    </Providers>
  );
}
