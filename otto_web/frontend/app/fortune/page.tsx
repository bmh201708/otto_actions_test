import { FortuneClient } from "./fortune-client";

export default function FortunePage({
  searchParams
}: {
  searchParams?: { tag?: string };
}) {
  return <FortuneClient tag={searchParams?.tag ?? null} />;
}
