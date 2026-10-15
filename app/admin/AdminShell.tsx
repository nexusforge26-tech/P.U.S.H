import React from "react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-10">{children}</div>
    </main>
  );
}

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/35 p-5 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] bg-white p-6 shadow-soft`}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold text-olive-dark">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-ink/40 hover:bg-olive/5"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
