import sys

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find exact line numbers
start_line = None
end_line = None
for i, l in enumerate(lines):
    if '      y = 44;' in l and start_line is None:
        start_line = i + 1  # line after y = 44;
    if 'Sauvegarde' in l and end_line is None:
        end_line = i

sys.stderr.write(f"start_line={start_line}, end_line={end_line}\n")

new_section = """
      // Infos dossier
      const typeLabels = { faute_grave:'Faute grave', faute_non_grave:'Faute non grave', economique:'Licenciement economique', abusif:'Licenciement abusif' };
      const catLabels  = { cadre:'Cadre', employe:'Employe', ouvrier:'Ouvrier' };
      const secteurLabel = this.form.secteur === 'SMAG' ? 'Agricole (SMAG - 191h)' : 'Non agricole (SMIG - 208h)';

      y = sectionTitle('INFORMATIONS DU DOSSIER', y);

      const infoGrid = [
        ['Salarie',    this.dossier.nomSalarie || '-',   'Poste',        this.dossier.poste || '-'],
        ['Type',       typeLabels[this.form.type] || this.form.type, 'Categorie', catLabels[this.form.category] || this.form.category],
        ['Anciennete', this.form.seniority + ' an' + (this.form.seniority > 1 ? 's' : ''), 'Salaire brut', this.fmt(this.form.salary) + ' MAD / mois'],
        ['Secteur',    secteurLabel, 'Taux horaire', this.fmt(this.results.salaireHoraire) + ' MAD / heure'],
      ];
      if (this.form.hireDate) {
        const ed = this.form.endDate ? new Date(this.form.endDate).toLocaleDateString('fr-MA') : "Aujourd'hui";
        infoGrid.push(["Date embauche", new Date(this.form.hireDate).toLocaleDateString('fr-MA'), 'Date licenciement', ed]);
      }

      infoGrid.forEach((row, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(...BG); doc.rect(LM, y - 4, PW, 9.5, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...M);
        T(row[0] + ' :', LM + 2, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...K);
        T(String(row[1]), LM + 32, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...M);
        T(row[2] + ' :', 108, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...K);
        T(String(row[3]), 138, y);
        y += 10;
      });

      y += 6;

      // Banniere delegue
      if (this.form.isDelegate) {
        doc.setFillColor(255, 251, 235);
        doc.roundedRect(LM, y, PW, 14, 2, 2, 'F');
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.5);
        doc.roundedRect(LM, y, PW, 14, 2, 2, 'S');
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(146, 64, 14);
        T('SALARIE PROTEGE - Delegue du personnel', LM + 5, y + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 53, 15);
        T("Licenciement soumis a autorisation prealable de l'Inspecteur du Travail - Art. 457-470", LM + 5, y + 11);
        doc.setTextColor(...M);
        y += 20;
      }

      // Section Calcul
      y = sectionTitle('DETAIL DES INDEMNITES', y);

      doc.setFillColor(...BG);
      doc.rect(LM, y - 4, PW, 9.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...M);
      T('Base de calcul :', LM + 2, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...K);
      T(san(this.results.salaireHoraireFormula), LM + 32, y);
      y += 14;

      const rows = [];
      this.results.breakdown.forEach(l => {
        rows.push(['   ' + l.label, l.formula, this.fmt(l.amount) + ' MAD']);
      });
      rows.push([
        { content: 'Indemnite legale (Art. 52)', styles: { fontStyle:'bold', fillColor: GS, textColor: GD } },
        { content: '', styles: { fillColor: GS } },
        { content: this.fmt(this.results.indemniteLegale) + ' MAD', styles: { fontStyle:'bold', halign:'right', fillColor: GS, textColor: GD } },
      ]);
      rows.push(['Indemnite de preavis (Art. 43)', this.results.preFormula, this.fmt(this.results.indemnitePreavis) + ' MAD']);
      if (this.results.unpaidAmount > 0)
        rows.push(['Salaires non payes (' + this.results.unpaidDays + 'j)', this.results.unpaidFormula, this.fmt(this.results.unpaidAmount) + ' MAD']);
      if (this.results.leaveAmount > 0)
        rows.push(['Conges non pris (' + this.results.unusedLeave + 'j)', this.results.leaveFormula, this.fmt(this.results.leaveAmount) + ' MAD']);
      if (this.results.dommages > 0)
        rows.push(['Dommages et interets (Art. 41)', this.results.domFormula, this.fmt(this.results.dommages) + ' MAD']);

      doc.autoTable({
        startY: y,
        head: [['Composante', 'Formule de calcul', 'Montant']],
        body: rows.map(r => r.map(c => typeof c === 'string' ? san(c) : { ...c, content: san(c.content) })),
        margin: { left: LM, right: 15 },
        styles: { font:'helvetica', fontSize:9.5, cellPadding:5, textColor: K, lineColor: L, lineWidth: 0.15 },
        headStyles: { fillColor: G, textColor: [255,255,255], fontStyle:'bold', fontSize:9 },
        alternateRowStyles: { fillColor: [250, 249, 246] },
        columnStyles: {
          0: { cellWidth: 72 },
          1: { cellWidth: 74, textColor: M, fontSize: 8.5 },
          2: { cellWidth: 34, halign:'right', fontStyle:'bold' },
        },
      });

      y = doc.lastAutoTable.finalY + 6;

      // Bloc total
      doc.setFillColor(...G);
      doc.roundedRect(LM, y, PW, 20, 3, 3, 'F');
      doc.setFillColor(...GD);
      doc.roundedRect(LM, y, 5, 20, 3, 3, 'F');
      doc.rect(LM + 3, y, 2, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      T('TOTAL BRUT ESTIME', LM + 10, y + 8.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(190, 225, 210);
      T('Toutes composantes incluses - indicatif', LM + 10, y + 14.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
      T(this.fmt(this.results.total) + ' MAD', RM - 4, y + 13, { align:'right' });
      y += 28;

      // References legales
      if (y > 230) { doc.addPage(); y = 20; }
      y = sectionTitle('REFERENCES LEGALES', y);
      const legalRefs = [
        ['Art. 41',         'Dommages et interets - licenciement abusif, plafonne a 36 mois'],
        ['Art. 43',         'Preavis obligatoire selon anciennete et categorie professionnelle'],
        ['Art. 52',         'Bareme : 96h/an (1-5 ans) - 144h (6-10) - 192h (11-15) - 240h (>15)'],
        ['Art. 53',         'Base de calcul : salaire le plus favorable (52 semaines ou 3 mois)'],
        ['Decret 2-04-469', 'Delais de preavis par categorie : cadre / employe / ouvrier'],
      ];
      if (this.form.isDelegate) {
        legalRefs.push(['Art. 457-470', 'Protection delegue - autorisation inspecteur du travail obligatoire']);
      }
      legalRefs.forEach(([art, txt], idx) => {
        if (idx % 2 === 0) { doc.setFillColor(...BG); doc.rect(LM, y - 4, PW, 8.5, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...G);
        T(art, LM + 2, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...K);
        T(san(txt), LM + 38, y);
        y += 9;
      });
      y += 6;

      // Footer
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(...GS);
      doc.rect(0, y, 210, 0.8, 'F');
      y += 7;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...M);
      T('Document etabli a titre indicatif - les montants peuvent varier selon la situation reelle.', LM, y);
      y += 5;
      T('Consultez un avocat specialise en droit social marocain pour votre situation specifique.', LM, y);
      y += 5;
      if (this.currentUser) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...M);
        T('Etabli par : ' + this.currentUser.email + '   -   ' + dateStr + ' a ' + timeStr, LM, y);
        y += 5;
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...G);
      T('IndemnPro - indemnpro.ma - Loi 65-99', LM, y);

"""

new_lines = lines[:start_line] + [new_section] + lines[end_line:]

with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done! PDF section replaced.")
