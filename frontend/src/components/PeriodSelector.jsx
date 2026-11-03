import { PERIOD_PRESETS, makePeriod } from '../utils/dates';

// Period dropdown + custom date inputs. `period` is { preset, startDate, endDate }.
export default function PeriodSelector({ period, onChange, allowAll = false }) {
  const handlePreset = (e) => {
    const preset = e.target.value;
    if (preset === 'custom') {
      // keep the current dates as a starting point for the custom range
      onChange({ preset, startDate: period.startDate, endDate: period.endDate });
    } else {
      onChange(makePeriod(preset));
    }
  };

  const handleDate = (field) => (e) => {
    const next = { ...period, preset: 'custom', [field]: e.target.value };
    // only apply a custom range once both dates are set and in order
    if (next.startDate && next.endDate && next.startDate > next.endDate) return;
    onChange(next);
  };

  return (
    <div className="period-selector">
      <label className="sr-only" htmlFor="period-select">Date range</label>
      <select id="period-select" className="select" value={period.preset} onChange={handlePreset}>
        {allowAll && <option value="all">All time</option>}
        {PERIOD_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      {period.preset === 'custom' && (
        <div className="period-custom">
          <input type="date" className="input" aria-label="Start date" value={period.startDate} max={period.endDate || undefined} onChange={handleDate('startDate')} />
          <span className="period-sep">to</span>
          <input type="date" className="input" aria-label="End date" value={period.endDate} min={period.startDate || undefined} onChange={handleDate('endDate')} />
        </div>
      )}
    </div>
  );
}
