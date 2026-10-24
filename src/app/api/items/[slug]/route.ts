import { NextResponse } from "next/server";

import { getItem } from "@/lib/queries";

/**
 * One item, for the hover popout.
 *
 * The list page carries the summary for every item; the popout needs the
 * effect text and stats, which are heavier. Fetching on demand keeps the
 * list's payload small.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const item = await getItem(slug);

  if (!item) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
