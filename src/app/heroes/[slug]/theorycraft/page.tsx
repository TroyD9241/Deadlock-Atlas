import { permanentRedirect } from "next/navigation";

/**
 * The theorycraft tool moved to `/theorycraft/[slug]`.
 *
 * It is a top-level page now rather than a sub-page of a hero, so the old
 * path redirects. The build state travels in the query string and localStorage
 * is keyed by hero, so the hero staying in the path means nothing about the
 * build is lost in the move.
 */
export default async function LegacyTheorycraftRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/theorycraft/${slug}`);
}
