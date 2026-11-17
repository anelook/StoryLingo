import { AdventureView } from "@/components/adventure-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdventureView id={id} />;
}
