import { HeroDropdown } from "./hero-dropdown";
import { getReleasedHeroes } from "@/lib/queries";

export async function HeroNav() {
  const heroes = await getReleasedHeroes();
  return <HeroDropdown heroes={heroes} />;
}