/**
 * Utilitaires pour l'export de données
 */

// Fonction pour exporter en CSV
export const exportToCSV = (data: any[], filename: string, headers: string[]) => {
  const csvContent = [
    headers,
    ...data.map(row => headers.map(header => {
      const value = row[header] ?? '';
      // Échapper les guillemets et les virgules
      return `"${String(value).replace(/"/g, '""')}"`;
    }))
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

    // Télécharger
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

