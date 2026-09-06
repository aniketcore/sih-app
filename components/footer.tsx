export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
      <div className="mx-auto max-w-xl space-y-1">
        <p className="text-slate-700">
          Made with ❤️ by{" "}
          <a
            className="underline hover:text-black font-medium"
            href="https://aniketsh.me"
            rel="noopener noreferrer"
            target="_blank"
          >
            Aniket Sharma
          </a>
        </p>
        <br />
        <p className="font-medium text-slate-700">IDEA Lab club PCE</p>
      </div>
    </footer>
  );
}
