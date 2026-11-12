import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NAV_MORE } from "@/components/ui/nav";

export default function MaisPage() {
  return (
    <>
      <PageHeader title="Mais" />
      <ul className="overflow-hidden rounded-md border border-line bg-bg-2">
        {NAV_MORE.map(({ href, label, icon: Icon }) => (
          <li key={href} className="border-b border-line last:border-b-0">
            <Link
              href={href}
              className="flex h-14 items-center gap-3 px-4 text-text-0 transition-colors duration-150 hover:bg-bg-3"
            >
              <Icon size={20} strokeWidth={1.5} className="text-text-2" />
              <span className="flex-1 text-sm">{label}</span>
              <ChevronRight size={20} strokeWidth={1.5} className="text-text-2" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
