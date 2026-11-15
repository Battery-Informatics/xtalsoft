import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as $3Dmol from '3dmol';
import {
  RotateCcw,
  Box,
  Layers,
  Tag,
  Download,
  Eye,
  FileCode,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { StructureAnalysisResult } from '../types';

interface CrystalViewer3DProps {
  analysis: StructureAnalysisResult;
}

type RenderStyle = 'ballAndStick' | 'spaceFilling' | 'polyhedral';
type SupercellDim = '1x1x1' | '2x2x2' | '3x3x3';

export const CrystalViewer3D: React.FC<CrystalViewer3DProps> = ({ analysis }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const [style, setStyle] = useState<RenderStyle>('ballAndStick');
  const [supercell, setSupercell] = useState<SupercellDim>('1x1x1');
  const [showUnitCell, setShowUnitCell] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [showPolyhedra, setShowPolyhedra] = useState<boolean>(true);

  // Generate supercell CIF or model coordinates
  const activeCif = useMemo(() => {
    const baseCif = analysis.cif_conventional || analysis.cif_standardized || analysis.cif_primitive;
    if (!baseCif) return '';

    if (supercell === '1x1x1') {
      return baseCif;
    }

    const mult = supercell === '2x2x2' ? 2 : 3;
    const lat = analysis.lattice;
    const a = lat.a * mult;
    const b = lat.b * mult;
    const c = lat.c * mult;

    const lines: string[] = [
      'data_crystal_supercell',
      `_cell_length_a ${a.toFixed(6)}`,
      `_cell_length_b ${b.toFixed(6)}`,
      `_cell_length_c ${c.toFixed(6)}`,
      `_cell_angle_alpha ${lat.alpha.toFixed(4)}`,
      `_cell_angle_beta ${lat.beta.toFixed(4)}`,
      `_cell_angle_gamma ${lat.gamma.toFixed(4)}`,
      "_symmetry_space_group_name_H-M 'P 1'",
      '_symmetry_Int_Tables_number 1',
      '',
      'loop_',
      ' _symmetry_equiv_pos_as_xyz',
      " 'x, y, z'",
      '',
      'loop_',
      ' _atom_site_label',
      ' _atom_site_type_symbol',
      ' _atom_site_fract_x',
      ' _atom_site_fract_y',
      ' _atom_site_fract_z',
      ' _atom_site_occupancy',
    ];

    let count = 0;
    for (let ix = 0; ix < mult; ix++) {
      for (let iy = 0; iy < mult; iy++) {
        for (let iz = 0; iz < mult; iz++) {
          for (const at of analysis.atoms) {
            count++;
            const u = (at.frac_coords[0] + ix) / mult;
            const v = (at.frac_coords[1] + iy) / mult;
            const w = (at.frac_coords[2] + iz) / mult;
            const lbl = `${at.element}${count}`;
            lines.push(
              ` ${lbl.padEnd(6)} ${at.element.padEnd(3)} ${u.toFixed(6)} ${v.toFixed(6)} ${w.toFixed(6)} 1.000`
            );
          }
        }
      }
    }
    lines.push('');
    return lines.join('\n');
  }, [analysis, supercell]);

  // Initialize and update 3Dmol viewer
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose old viewer canvas if re-initializing
    containerRef.current.innerHTML = '';

    const viewer = ($3Dmol as any).createViewer(containerRef.current, {
      backgroundColor: '0x020617', // slate-950
    });
    viewerRef.current = viewer;

    if (!activeCif) return;

    viewer.addModel(activeCif, 'cif');

    // Apply styles
    applyViewerStyles(viewer);

    viewer.zoomTo();
    viewer.render();

    const handleResize = () => {
      if (viewerRef.current) {
        viewerRef.current.resize();
        viewerRef.current.render();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [activeCif]);

  // Re-apply style and overlay toggles
  const applyViewerStyles = (viewer: any) => {
    if (!viewer) return;

    // Reset styles and labels
    viewer.removeAllLabels();
    viewer.removeAllShapes();

    // 1. Core atomic rendering styles
    if (style === 'spaceFilling') {
      viewer.setStyle({}, { sphere: { scale: 0.82, colorscheme: 'Jmol' } });
    } else if (style === 'ballAndStick') {
      viewer.setStyle(
        {},
        {
          stick: { radius: 0.16, colorscheme: 'Jmol' },
          sphere: { scale: 0.32, colorscheme: 'Jmol' },
        }
      );
    } else if (style === 'polyhedral') {
      // Highlight transition metal octahedra / coordination
      viewer.setStyle(
        {},
        {
          stick: { radius: 0.14, colorscheme: 'Jmol' },
          sphere: { scale: 0.28, colorscheme: 'Jmol' },
        }
      );
      // Highlight Oxygen and Transition Metals
      viewer.setStyle({ elem: 'O' }, { sphere: { scale: 0.25, color: '#ef4444' } });
      viewer.setStyle({ elem: 'Li' }, { sphere: { scale: 0.32, color: '#10b981' } });
    }

    // 2. Unit cell bounding box
    if (showUnitCell) {
      viewer.addUnitCell();
    }

    // 3. Atom Labels
    if (showLabels) {
      const atoms = viewer.selectedAtoms({});
      for (let i = 0; i < Math.min(atoms.length, 120); i++) {
        const a = atoms[i];
        viewer.addLabel(a.elem, {
          position: { x: a.x, y: a.y, z: a.z },
          fontSize: 10,
          fontColor: '#f8fafc',
          backgroundColor: '#0f172a',
          backgroundOpacity: 0.7,
        });
      }
    }

    viewer.render();
  };

  useEffect(() => {
    if (viewerRef.current) {
      applyViewerStyles(viewerRef.current);
    }
  }, [style, showUnitCell, showLabels, showPolyhedra]);

  const handleResetCamera = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  };

  const handleDownloadCif = () => {
    const cifData = activeCif || analysis.cif_standardized;
    const blob = new Blob([cifData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `structure_${analysis.tag}_${supercell}.cif`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPoscar = () => {
    const blob = new Blob([analysis.poscar], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `POSCAR_${analysis.tag}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Viewer Toolbar */}
      <div className="bg-slate-950/80 p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Supercell & Render Style */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Supercell selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Supercell:</span>
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {(['1x1x1', '2x2x2', '3x3x3'] as SupercellDim[]).map((dim) => (
                <button
                  key={dim}
                  onClick={() => setSupercell(dim)}
                  className={`px-2 py-0.5 rounded transition-all text-xs font-mono ${
                    supercell === dim
                      ? 'bg-emerald-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          </div>

          {/* Style switcher */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>Style:</span>
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              {[
                { id: 'ballAndStick', label: 'Ball & Stick' },
                { id: 'spaceFilling', label: 'Space-Filling' },
                { id: 'polyhedral', label: 'Polyhedral' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id as RenderStyle)}
                  className={`px-2.5 py-0.5 rounded transition-all text-xs ${
                    style === s.id
                      ? 'bg-slate-800 text-emerald-400 font-medium border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Toggles, Reset & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Polyhedra Toggle */}
          <button
            onClick={() => setShowPolyhedra(!showPolyhedra)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${
              showPolyhedra
                ? 'bg-purple-950/70 text-purple-300 border-purple-800'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle Coordination Polyhedra / Bonds"
          >
            <Sparkles className="w-3 h-3" />
            Polyhedra
          </button>

          {/* Unit Cell Toggle */}
          <button
            onClick={() => setShowUnitCell(!showUnitCell)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${
              showUnitCell
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle Unit Cell Bounding Box"
          >
            <Box className="w-3 h-3" />
            Unit Cell
          </button>

          {/* Labels Toggle */}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${
              showLabels
                ? 'bg-sky-950/70 text-sky-300 border-sky-800'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="Toggle Element Labels"
          >
            <Tag className="w-3 h-3" />
            Labels
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Camera View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* One-click CIF Download */}
          <button
            onClick={handleDownloadCif}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors shadow-sm"
            title="Download Standardized .cif file"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            .CIF
          </button>

          {/* One-click POSCAR Download */}
          <button
            onClick={handleDownloadPoscar}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-colors shadow-sm"
            title="Download VASP POSCAR file"
          >
            <FileCode className="w-3 h-3 text-cyan-400" />
            POSCAR
          </button>
        </div>
      </div>

      {/* WebGL Canvas Container */}
      <div className="relative w-full h-[450px] bg-slate-950">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Crystallographic Overlay Pill */}
        <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono shadow-lg flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Shield className="w-3.5 h-3.5" />
            {analysis.space_group.symbol} (#{analysis.space_group.number})
          </span>
          <span className="text-slate-500">•</span>
          <span>{analysis.crystal_system}</span>
          <span className="text-slate-500">•</span>
          <span>
            a={analysis.lattice.a.toFixed(2)} b={analysis.lattice.b.toFixed(2)} c={analysis.lattice.c.toFixed(2)} Å
          </span>
        </div>
      </div>
    </div>
  );
};
