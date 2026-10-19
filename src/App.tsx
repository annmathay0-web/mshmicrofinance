import { useEffect, useState } from "react";
import { AppProvider, useApp, useToasts } from "./lib/state";
import { destroySession, getSession } from "./lib/auth";
import { installGlobalKhmerDigitConverter } from "./lib/security";
import ImportConfirm from "./components/ImportConfirm";
import Login from "./components/Login";
import Shell from "./components/Shell";
import Dashboard from "./views/Dashboard";
import Collection from "./views/Collection";
import Loans from "./views/Loans";
import NewLoan from "./views/NewLoan";
import LoanDetail from "./views/LoanDetail";
import Settings from "./views/Settings";
import { cn } from "./utils/cn";

function ToastStack() {
  const { toasts, dismissToast } = useToasts();
  const icons: Record<string, string> = {
    success: "fa-circle-check text-mint-400",
    error: "fa-circle-xmark text-red-400",
    info: "fa-circle-info text-gold-400",
  };
  return (
    <div className="pointer-events-none fixed bottom-24 right-5 z-[80] flex w-[min(92vw,380px)] flex-col gap-2 lg:bottom-5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-slide-right pointer-events-auto flex items-start gap-3 rounded-xl bg-navy-950 px-4 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-navy-950/50 ring-1 ring-white/10"
        >
          <i className={cn("fa-solid mt-0.5", icons[t.kind])} />
          <p className="flex-1 leading-5">{t.msg}</p>
          <button onClick={() => dismissToast(t.id)} className="text-navy-400 transition-colors hover:text-white">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Views() {
  const { view } = useApp();

  useEffect(() => {
    document.body.style.overflow = "";
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [view]);

  switch (view.name) {
    case "dashboard":
      return <Dashboard />;
    case "collection":
      return <Collection />;
    case "loans":
      return <Loans />;
    case "new":
      return <NewLoan />;
    case "loan":
      return <LoanDetail id={view.id} key={view.id} />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function Gate() {
  const { db, go, toast } = useApp();
  const [authed, setAuthed] = useState(() => getSession() !== null);

  if (!authed) {
    return (
      <Login
        onSuccess={() => {
          setAuthed(true);
          toast(
            db.loans.length === 0
              ? "សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងឥណទាន"
              : "សូមស្វាគមន៍មកកាន់ MSH Microfinance"
          );
        }}
      />
    );
  }

  return (
    <Shell
      onLogout={() => {
        destroySession();
        go({ name: "dashboard" });
        setAuthed(false);
        toast("បានចាកចេញពី Session ដោយជោគជ័យ", "info");
      }}
    >
      <Views />
    </Shell>
  );
}

export default function App() {
  useEffect(() => {
    return installGlobalKhmerDigitConverter();
  }, []);

  return (
    <AppProvider>
      <Gate />
      <ImportConfirm />
      <ToastStack />
    </AppProvider>
  );
}
