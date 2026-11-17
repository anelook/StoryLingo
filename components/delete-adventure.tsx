"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "@/lib/client";

export function DeleteAdventure({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${title}`}
      onClick={async () => {
        if (!confirm(`Delete “${title}”? Its corrections and progress for this adventure will be removed.`)) return;
        await api(`/api/adventures/${id}`, { method: "DELETE" }).catch((e) => alert(e.message));
        router.refresh();
      }}
    >
      <Trash2 />
    </Button>
  );
}
