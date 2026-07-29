import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="container page">
      <h1>صفحه پیدا نشد</h1>
      <Link href="/">بازگشت به خانه</Link>
    </main>
  );
}
