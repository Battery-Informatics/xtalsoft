import React, { useEffect, useRef, useState, useMemo } from 'react';
import { RotateCcw, Box, Tag, Download, FileCode, Shield } from 'lucide-react';
import * as $3Dmol from '3dmol';
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
      backgroundColor: '0x1b1b1f',
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
      viewer.addUnitCell(undefined, { box: { color: '#98989f' } });
    }

    // 3. Atom Labels
    if (showLabels) {
      const atoms = viewer.selectedAtoms({});
      for (let i = 0; i < Math.min(atoms.length, 120); i++) {
        const a = atoms[i];
        viewer.addLabel(a.elem, {
          position: { x: a.x, y: a.y, z: a.z },
          fontSize: 10,
          fontColor: '#dfdfd6',
          backgroundColor: '#202127',
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
    <div className="bg-surface border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      {/* Viewer Toolbar */}
      <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Supercell & Render Style */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Supercell selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Supercell:</span>
            <div className="flex bg-surface p-0.5 rounded-lg border border-slate-200">
              {(['1x1x1', '2x2x2', '3x3x3'] as SupercellDim[]).map((dim) => (
                <button
                  key={dim}
                  onClick={() => setSupercell(dim)}
                  className={`px-2 py-0.5 rounded transition-all text-xs font-mono ${
                    supercell === dim
                      ? 'bg-slate-300 text-slate-900 font-medium'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          </div>

          {/* Style switcher */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Style:</span>
            <div className="flex bg-surface p-0.5 rounded-lg border border-slate-200">
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
                      ? 'bg-surface text-slate-900 font-medium border border-slate-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
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
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-surface text-slate-500 border-slate-200'
            }`}
            title="Toggle Coordination Polyhedra / Bonds"
          >
            Polyhedra
          </button>

          {/* Unit Cell Toggle */}
          <button
            onClick={() => setShowUnitCell(!showUnitCell)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 border transition-all ${
              showUnitCell
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-surface text-slate-500 border-slate-200'
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
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-surface text-slate-500 border-slate-200'
            }`}
            title="Toggle Element Labels"
          >
            <Tag className="w-3 h-3" />
            Labels
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded bg-surface border border-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
            title="Reset Camera View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* One-click CIF Download */}
          <button
            onClick={handleDownloadCif}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-mono transition-colors shadow-sm"
            title="Download Standardized .cif file"
          >
            <Download className="w-3 h-3 text-slate-900" />
            .CIF
          </button>

          {/* One-click POSCAR Download */}
          <button
            onClick={handleDownloadPoscar}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-mono transition-colors shadow-sm"
            title="Download VASP POSCAR file"
          >
            <FileCode className="w-3 h-3 text-blue-700" />
            POSCAR
          </button>
        </div>
      </div>

      {/* WebGL Canvas Container */}
      <div className="relative w-full h-[450px] bg-slate-50">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Crystallographic Overlay Pill */}
        <div className="absolute bottom-3 left-3 bg-surface px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-mono flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-900 font-semibold">
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
