import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/50 p-4">
      <DotsLoader size="md" color="bg-[#044d73]" text="Loading..." />
    </div>
  );
}
