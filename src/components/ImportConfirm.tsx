import { useApp } from "../lib/state";
import { Modal } from "./ui";

/**
 * Shown whenever a validated backup file is staged for import.
 * Makes the overwrite explicit - current vs incoming counts side by side.
 */
export default function ImportConfirm() {
  const { db, pendingImport, confirmImport, cancelImport } = useApp();

  if (!pendingImport) return null;

  const inc = pendingImport.db;

  return (
    <Modal onClose={cancelImport} maxW="max-w-md">
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-lg text-gold-600">
            <i className="fa-solid fa-file-import" />
          </span>
          <div className="min-w-0">
            <p className="font-num text-[10px] font-bold uppercase tracking-[0.2em] text-gold-600">Restore Backup</p>
            <h3 className="mt-0.5 text-lg font-bold leading-6 text-navy-900">បញ្ជាក់ការនាំចូលទិន្នន័យ?</h3>
            {pendingImport.fileName && (
              <p className="font-num mt-1 truncate text-xs text-slate-400">
                <i className="fa-solid fa-file mr-1" /> {pendingImport.fileName}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-navy-100 bg-navy-50/60 p-3.5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ទិន្នន័យបច្ចុប្បន្ន</p>
            <p className="font-num mt-1 text-2xl font-bold text-navy-800">{db.loans.length}</p>
            <p className="text-[11px] font-semibold text-slate-500">កម្ចី ({db.payments.length} បង់)</p>
          </div>
          <div className="relative rounded-xl border-2 border-gold-300 bg-gold-50 p-3.5 text-center">
            <span className="absolute -top-2.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-gold-400 text-navy-950 shadow">
              <i className="fa-solid fa-arrow-right text-[9px]" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gold-700">ទិន្នន័យថ្មី (Backup)</p>
            <p className="font-num mt-1 text-2xl font-bold text-gold-700">{inc.loans.length}</p>
            <p className="text-[11px] font-semibold text-gold-600">កម្ចី ({inc.payments.length} បង់)</p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">
          <i className="fa-solid fa-triangle-exclamation mt-0.5" />
          <div>
            <span className="font-bold">ការព្រមាន៖</span> ការនាំចូលនេះនឹងជំនួសទិន្នន័យបច្ចុប្បន្នទាំងអស់លើឧបករណ៍នេះ។
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={confirmImport}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-navy-800 py-3 font-bold text-white shadow-lg shadow-navy-900/20 transition-all hover:-translate-y-0.5 hover:bg-navy-700 active:translate-y-0"
          >
            <i className="fa-solid fa-check text-gold-400" /> បញ្ជាក់ជំនួស
          </button>
          <button
            onClick={cancelImport}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white py-3 font-bold text-navy-700 transition-colors hover:bg-navy-50"
          >
            <i className="fa-solid fa-xmark" /> បោះបង់
          </button>
        </div>
      </div>
    </Modal>
  );
}
