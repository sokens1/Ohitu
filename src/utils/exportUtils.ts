/**
 * Utilitaires pour l'export de données
 */

// Fonction pour exporter en CSV
export const exportToCSV = (data: any[], filename: string, headers: string[]) => {
  try {
    const csvContent = [
      headers.join(';'),
      ...data.map(row => 
        Object.values(row)
          .map(val => `"${String(val).replace(/"/g, '""')}"`)
          .join(';')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'export CSV:', error);
    return false;
  }
};

// Fonction pour exporter en Excel (format XLSX)
export const exportToExcel = async (data: any[], filename: string, headers: { key: string; label: string }[]) => {
  try {
    // Utiliser une bibliothèque légère ou créer un fichier CSV avec extension .xlsx
    // Pour une vraie exportation Excel, nous utiliserons xlsx
    const XLSX = await import('xlsx');
    
    // Préparer les données
    const worksheetData = [
      headers.map(h => h.label),
      ...data.map(row => headers.map(h => {
        const value = row[h.key];
        return value !== null && value !== undefined ? String(value) : '';
      }))
    ];

    // Créer le workbook
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Logs');

    // Sauvegarder
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'export Excel:', error);
    // Fallback vers CSV si xlsx n'est pas disponible
    exportToCSV(
      data,
      filename,
      headers.map(h => h.label)
    );
    return false;
  }
};

// Fonction pour exporter un modèle Excel multi-feuilles
export const exportMultiSheetExcel = async (
  filename: string,
  sheets: { name: string; data: any[]; headers: string[] }[]
) => {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    sheets.forEach(sheet => {
      const worksheetData = [
        sheet.headers,
        ...sheet.data.map(row => sheet.headers.map(header => row[header] ?? ''))
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du modèle Excel multi-feuilles:', error);
    return false;
  }
};

// Fonction pour exporter en PDF
export const exportToPDF = async (
  data: any[], 
  filename: string, 
  headers: { key: string; label: string }[],
  title: string = 'Rapport d\'audit'
) => {
  try {
    const jsPDF = (await import('jspdf')).default;
    // @ts-ignore - jspdf-autotable n'a pas de types officiels complets
    const autoTable = (await import('jspdf-autotable')).default;
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Ajouter le titre
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    
    // Ajouter la date d'export
    doc.setFontSize(10);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 22);

    // Préparer les données pour le tableau
    const tableData = data.map(row => 
      headers.map(h => {
        const value = row[h.key];
        return value !== null && value !== undefined ? String(value) : '';
      })
    );

    // Ajouter le tableau
    // @ts-ignore - Types pour autoTable
    autoTable(doc, {
      head: [headers.map(h => h.label)],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 28 },
    });

    // Sauvegarder
    doc.save(`${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'export PDF:', error);
    return false;
  }
};

// --- Templates pour Option B (Après configuration globale) ---

export const generateUnitesVoteTemplate = async () => {
  const headers = [
    "Nom Bureau de vote (Facultatif)",
    "Nom Établissement / Site",
    "Région / Localisation",
    "Responsable Établissement (Facultatif)",
    "Contact Téléphone (Facultatif)",
    "Nombre d'électeurs",
    "Collège concerné"
  ];

  const examples = [
    ["Bureau A - Rez de chaussée", "Siège Social Libreville", "Estuaire", "Marc Ondo", "+24177123456", "250", "Employés et Ouvriers"],
    ["Bureau B - 1er étage", "Siège Social Libreville", "Estuaire", "Marc Ondo", "+24177123456", "150", "Agent de maîtrise"],
    ["Bureau Unique - Franceville", "Agence Franceville", "Haut-Ogooué", "Lucie Mba", "+24166987654", "115", "general"]
  ];

  await exportMultiSheetExcel("modele_unites_vote", [
    { name: "Établissements & Bureaux", headers, data: examples.map(ex => Object.fromEntries(headers.map((h, i) => [h, ex[i]]))) }
  ]);
};

/** Modèle pro : feuille « Listes » (aligné sur listes.xlsx / modele_listes.xlsx). */
export const generateListesElectoralesTemplate = async () => {
  const headers = [
    'Acronyme_Representation',
    'Representation',
    'College',
    'Etablissement',
    'Titulaire',
    'Genre_Titulaire',
    'Anciennete_Titulaire',
    'Suppleant',
    'Genre_Suppleant',
  ];

  await exportMultiSheetExcel('listes', [
    { name: 'Listes', headers, data: [] },
  ]);
};

