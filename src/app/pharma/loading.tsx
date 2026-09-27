import { DotsLoader } from "@/app/pharma/_components/ui/dots-loader";

export default function PharmaLoading() {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center p-6">
      <DotsLoader size="md" color="bg-[#044d73]" text="Loading..." />
    </div>
  );
}
