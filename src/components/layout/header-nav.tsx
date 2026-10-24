import { NavLinks } from "./nav-links";
import { getReleasedHeroes } from "@/lib/queries";

export async function HeaderNav() {
  const heroes = await getReleasedHeroes();
  return <NavLinks heroes={heroes} />;
}