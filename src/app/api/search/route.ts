import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export const instant = false;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const lower = query.toLowerCase();

  // Search heroes
  const heroes = await db.hero.findMany({
    where: {
      isReleased: true,
      OR: [
        { name: { contains: lower, mode: "insensitive" } },
        { tagline: { contains: lower, mode: "insensitive" } },
        { officialRole: { contains: lower, mode: "insensitive" } },
      ],
    },
    select: { slug: true, name: true, heroType: true, artwork: true },
    take: 8,
  });

  // Search abilities
  const abilities = await db.ability.findMany({
    where: {
      OR: [
        { name: { contains: lower, mode: "insensitive" } },
        { className: { contains: lower, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, className: true, image: true },
    take: 8,
  });

  // Search items
  const items = await db.item.findMany({
    where: {
      OR: [
        { name: { contains: lower, mode: "insensitive" } },
        { className: { contains: lower, mode: "insensitive" } },
      ],
    },
    select: { slug: true, name: true, slotType: true, image: true },
    take: 8,
  });

  const results = [
    ...heroes.map((h) => ({
      type: "hero" as const,
      id: h.slug,
      name: h.name,
      subtitle: h.heroType ?? "hero",
      image: (h.artwork as { images?: { card?: string } })?.images?.card ?? null,
      href: `/heroes/${h.slug}`,
    })),
    ...abilities.map((a) => ({
      type: "ability" as const,
      id: a.id,
      name: a.name,
      subtitle: "ability",
      image: a.image,
      href: `/abilities`,
    })),
    ...items.map((i) => ({
      type: "item" as const,
      id: i.slug,
      name: i.name,
      subtitle: i.slotType ?? "item",
      image: i.image,
      href: `/items/${i.slug}`,
    })),
  ];

  return NextResponse.json({ results });
}