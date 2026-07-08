import { useMemo, useRef, useState } from 'react';
import { Upload, FileDown, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { parseCSV, toCSV, downloadCSV } from '../../lib/csv';
import { CSV_HEADERS, rowToLeadInput } from '../../lib/leadsCsv';
import type { NewLeadInput } from '../../services/leadsService';

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  defaultAssignee: string;
  onImport: (inputs: NewLeadInput[]) => Promise<number>;
}

export function ImportCsvModal({ open, onClose, defaultAssignee, onImport }: ImportCsvModalProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inputs = useMemo(() => {
    if (!text.trim()) return [];
    try {
      return parseCSV(text)
        .map((r) => rowToLeadInput(r, defaultAssignee))
        .filter((x): x is NewLeadInput => x !== null);
    } catch {
      return [];
    }
  }, [text, defaultAssignee]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!inputs.length || importing) return;
    setImporting(true);
    try {
      const n = await onImport(inputs);
      setResult(n);
      setText('');
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar prospectos (CSV)"
      subtitle="Sube o pega un CSV. Se crean como prospectos nuevos."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={doImport} disabled={!inputs.length || importing}>
            {importing ? 'Importando…' : `Importar ${inputs.length || ''} prospecto${inputs.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Elegir archivo .csv
          </button>
          <button
            className="btn-ghost"
            onClick={() => downloadCSV('plantilla-prospectos.csv', toCSV(CSV_HEADERS, []))}
          >
            <FileDown className="h-4 w-4" /> Descargar plantilla
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>

        <div>
          <label className="label">…o pega el CSV aquí</label>
          <textarea
            className="input min-h-[140px] resize-y font-mono text-xs"
            placeholder={`${CSV_HEADERS.join(',')}\nAcme Inc,Ana López,CEO,ana@acme.com,+52...,acme.com,Tecnología,Sitio web,Nuevo,5000,0,LinkedIn,,Necesitan web`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
          />
        </div>

        {text.trim() && (
          <p className="text-sm text-surface-500">
            {inputs.length > 0 ? (
              <>
                <span className="font-semibold text-surface-800">{inputs.length}</span> fila
                {inputs.length === 1 ? '' : 's'} válida{inputs.length === 1 ? '' : 's'} (con empresa).
              </>
            ) : (
              <span className="text-amber-600">
                No se detectaron filas válidas. Revisa que exista la columna “Empresa”.
              </span>
            )}
          </p>
        )}

        {result !== null && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Se importaron {result} prospecto{result === 1 ? '' : 's'}.
          </p>
        )}
      </div>
    </Modal>
  );
}
