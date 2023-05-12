import Head from "next/head";
import { getServerAuthSessionInServerComponent } from "~/server/auth";

export default async function Home() {
  const session = await getServerAuthSessionInServerComponent();
  console.log("session", session);

  return (
    <>
      <Head>
        <title>Notephemeral</title>
        <meta name="description" content="Ephemeral or permanent notes" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center">
        Notephemeral
      </main>
    </>
  );
}
