import React, { useState, useEffect } from 'react';
import { TemplateEditor } from './TemplateEditor';
import { XtaloptInPreview } from './XtaloptInPreview';
import { previewXtaloptIn, createPreset, createExperiment } from '../api/client';
import type { Preset } from '../types';

interface StudioProps {
  initialPreset?: Preset | null;
  onPresetSaved?: () => void;
  onExperimentLaunched?: (expId: string) => void;
}

export const ExperimentStudio: React.FC<StudioProps> = ({
  initialPreset,
  onPresetSaved,
  onExperimentLaunched,
}) => {
  // Form State
  const [name, setName] = useState('New Battery EA Experiment');
  const [description, setDescription] = useState('');
  const [chemicalFormulas, setChemicalFormulas] = useState('Ti2O4 - Ti4O8');
  const [minAtoms, setMinAtoms] = useState(6);
  const [maxAtoms, setMaxAtoms] = useState(12);
  const [numInitial, setNumInitial] = useState(10);
  const [popSize, setPopSize] = useState(10);
  const [maxNumStructures, setMaxNumStructures] = useState(50);
  const [optimizer] = useState('gulp');
  const [directRunCommand] = useState('gulp');
  const [referenceEnergies, setReferenceEnergies] = useState('');
  const [ginTemplate, setGinTemplate] = useState('');

  // UI state
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load preset if provided
  useEffect(() => {
    if (initialPreset) {
      setName(initialPreset.name);
      setDescription(initialPreset.description || '');
      setChemicalFormulas(initialPreset.chemicalFormulas);
      setMinAtoms(initialPreset.minAtoms);
      setMaxAtoms(initialPreset.maxAtoms);
      setNumInitial(initialPreset.numInitial);
      setPopSize(initialPreset.popSize);
      setMaxNumStructures(initialPreset.maxNumStructures);
      setReferenceEnergies(initialPreset.referenceEnergies || '');
      setGinTemplate(initialPreset.ginTemplate);
    } else {
      // Default GULP template
      setGinTemplate(`opti conj conp
switch_minimiser bfgs gnorm 0.5
cell
  %a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%
frac
%coordsFrac%
species
Ti 2.196
O -1.098
buck
Ti Ti 31120.1 0.1540 5.25  15
O  O  11782.7 0.2340 30.22 15
Ti O  16957.5 0.1940 12.59 15
lennard 12 6
Ti Ti 1 0 15
O  O  1 0 15
Ti O  1 0 15
`);
    }
  }, [initialPreset]);

  // Update preview whenever parameters change
  const refreshPreview = async () => {
    setPreviewLoading(true);
    try {
      const configPayload = {
        chemical_formulas: chemicalFormulas,
        min_atoms: Number(minAtoms),
        max_atoms: Number(maxAtoms),
        reference_energies: referenceEnergies.trim() ? referenceEnergies.trim() : null,
        search: {
          num_initial: Number(numInitial),
          parents_pool_size: Number(popSize),
          max_num_structures: Number(maxNumStructures),
        },
        optimizer_cfg: {
          optimizer: optimizer,
          direct_run_command: directRunCommand,
          custom_gulp_template: ginTemplate,
        },
      };
      const text = await previewXtaloptIn(configPayload);
      setPreviewContent(text);
    } catch (e: any) {
      setPreviewContent(`# Error generating preview: ${e.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [chemicalFormulas, minAtoms, maxAtoms, numInitial, popSize, maxNumStructures, referenceEnergies, ginTemplate]);

  // Handle Save Preset
  const handleSavePreset = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await createPreset({
        name,
        description,
        chemicalFormulas,
        minAtoms: Number(minAtoms),
        maxAtoms: Number(maxAtoms),
        numInitial: Number(numInitial),
        popSize: Number(popSize),
        maxNumStructures: Number(maxNumStructures),
        optimizer,
        directRunCommand,
        ginTemplate,
        referenceEnergies: referenceEnergies.trim() ? referenceEnergies.trim() : null,
      });
      setFeedback({ type: 'success', message: 'Preset saved successfully to presets/!' });
      if (onPresetSaved) onPresetSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save preset' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Launch Experiment
  const handleLaunchExperiment = async (startImmediately: boolean) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await createExperiment({
        name,
        description,
        chemicalFormulas,
        minAtoms: Number(minAtoms),
        maxAtoms: Number(maxAtoms),
        numInitial: Number(numInitial),
        parentsPoolSize: Number(popSize),
        maxNumStructures: Number(maxNumStructures),
        optimizer,
        directRunCommand,
        ginTemplate,
        referenceEnergies: referenceEnergies.trim() ? referenceEnergies.trim() : null,
        start_immediately: startImmediately,
      });
      setFeedback({
        type: 'success',
        message: `Experiment created in runs/${result.exp_id}/! ${startImmediately ? 'Process started.' : 'Ready for execution.'}`,
      });
      if (onExperimentLaunched) onExperimentLaunched(result.exp_id);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to launch experiment' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">New experiment</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {name || 'Experiment Configuration'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Set the composition range, population size and GULP force field, then stage or launch the XtalOpt run.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSavePreset}
            disabled={submitting}
            className="h-9 px-3.5 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 cursor-pointer"
          >
            Save as preset
          </button>
          <button
            onClick={() => handleLaunchExperiment(false)}
            disabled={submitting}
            className="h-9 px-3.5 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 cursor-pointer"
          >
            Stage only
          </button>
          <button
            onClick={() => handleLaunchExperiment(true)}
            disabled={submitting}
            className="h-9 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            Launch run
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-lg text-sm flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Grid: Form & Editors on left (7 cols), Preview on right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Columns: Form Fields */}
        <div className="lg:col-span-7 space-y-6">
          {/* General Metadata */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Details
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Experiment Title
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="e.g. LiCoO2 Cathode GULP Screening"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Research motivation, force-field notes, expected polymorphs..."
                />
              </div>
            </div>
          </div>

          {/* Formula Unit Builder & Population Parameters */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Composition and population
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Chemical Formula Range (<code className="text-blue-700 font-mono">chemicalFormulas</code>)
                </label>
                <input
                  type="text"
                  value={chemicalFormulas}
                  onChange={(e) => setChemicalFormulas(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="e.g. Ti2O4 - Ti4O8, or Li1Fe1P1O4"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Single stoichiometry (e.g. <span className="font-mono text-slate-600">TiO2</span>) or hyphenated supercell range (e.g. <span className="font-mono text-slate-600">Ti2O4 - Ti4O8</span>).
                </p>
              </div>

              {/* Min / Max atoms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Min Atoms (<code className="text-slate-600 font-mono">minAtoms</code>)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={minAtoms}
                    onChange={(e) => setMinAtoms(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Max Atoms (<code className="text-slate-600 font-mono">maxAtoms</code>)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxAtoms}
                    onChange={(e) => setMaxAtoms(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Population Settings */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Initial Seeds (<code className="text-slate-600 font-mono">numInitial</code>)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={numInitial}
                    onChange={(e) => setNumInitial(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Parent Pool (<code className="text-slate-600 font-mono">popSize</code>)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={popSize}
                    onChange={(e) => setPopSize(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Max Total (<code className="text-slate-600 font-mono">maxNumStructures</code>)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxNumStructures}
                    onChange={(e) => setMaxNumStructures(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Reference energies */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Reference Energies (Optional for variable composition)
                </label>
                <input
                  type="text"
                  value={referenceEnergies}
                  onChange={(e) => setReferenceEnergies(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                  placeholder="e.g. Ti3 -14.18719749, O4 -10.19855357"
                />
              </div>
            </div>
          </div>

          {/* GULP Template Editor */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <TemplateEditor template={ginTemplate} onChange={setGinTemplate} />
          </div>
        </div>

        {/* Right Column: Live xtalopt.in Preview (Sticky) */}
        <div className="lg:col-span-5 sticky top-24">
          <XtaloptInPreview
            content={previewContent}
            loading={previewLoading}
            onRefresh={refreshPreview}
          />

          <div className="mt-4 p-4 rounded-lg bg-slate-100 text-xs text-slate-600 space-y-2">
            <div className="font-medium text-slate-700">
              Where files are written
            </div>
            <p>
              When staged or launched, an isolated folder <code className="text-blue-700 font-mono">runs/&lt;exp_id&gt;/</code> is created with pure text files (<code className="text-slate-700 font-mono">xtalopt.in</code>, <code className="text-slate-700 font-mono">templates/gulp/gin1</code>, and <code className="text-slate-700 font-mono">meta.json</code>). 
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
