import Image from "next/image";
import QRScanner from "./components/QRScanner";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-12 px-6 bg-white dark:bg-black sm:items-start">
        <div className="w-full flex items-center justify-between">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
        </div>

        <section className="w-full mt-6">
          <QRScanner />
        </section>

      </main>
    </div>
  );
}
