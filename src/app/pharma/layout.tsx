import { Sidebar } from './_components/Sidebar';

export default function PharmaLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-zinc-50">
            <Sidebar
                brandName="Pharma"
                user={{ name: 'Pratha', email: 'pratha@example.com' }}
            />

            <main className="flex-1 p-6 pt-20 md:pt-6">
                {children}
            </main>
        </div>
    );
}