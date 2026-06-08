function app() {
  return {
    lang: 'fr',
    darkMode: false,
    currentUser: null,
    activeTab: 'calc',
    wizardStep: 1,
    results: null,
    openRef: null,
    form: {
      salary: null,
      seniority: 5,
      category: null,
      type: null,
      hireDate: '',
      endDate: '',
      unpaidDays: 0,
      unusedLeave: 0,
      secteur: 'SMIG',      // SMIG = 208h/mois | SMAG = 191h/mois
      isDelegate: false,    // Délégué du personnel (protection Art. 457-470)
    },

    // ① Historique
    showHistory: false,
    history: [],

    // ② Partage URL
    copiedUrl: false,

    // ③ Calculateur de dates
    dateForm: { notifDate: '', category: null, seniority: 5, type: 'faute_non_grave' },
    dateResults: null,

    // ④ Infos dossier (pour PDF)
    dossier: { nomSalarie: '', poste: '', ref: '' },

    // Freemium — mode invité
    isGuest: false,
    trialCount: 0,
    showTrialWall: false,
    TRIAL_LIMIT: 2,

    // ⑤ Dossiers Supabase (persistant cross-device)
    dossiers: [],
    loadingDossiers: false,
    savingDossier: false,
    dossierSaved: false,
    dossierSearch: '',
    dossierStatusFilter: 'all',
    dossierSort: 'recent',

    tabs: [
      { id: 'calc',      icon: '🧮', labelKey: 'nav_calc' },
      { id: 'dossiers',  icon: '📁', labelKey: 'nav_dossiers' },
      { id: 'procedure', icon: '📋', labelKey: 'nav_procedure' },
      { id: 'types',     icon: '📂', labelKey: 'nav_types' },
      { id: 'refs',      icon: '⚖️',  labelKey: 'nav_refs' },
      { id: 'dates',     icon: '📅', labelKey: 'nav_dates' },
    ],

    // Lifecycle — mode connecté ou invité (2 essais gratuits)
    async init() {
      const session = await getSession();
      if (session) {
        // Utilisateur connecté — accès complet
        this.currentUser = session.user;
        this.isGuest = false;
        this.loadHistory();
        this.loadDossiers();
      } else {
        // Invité — 2 calculs gratuits, pas de dossiers
        this.isGuest = true;
        this.trialCount = parseInt(localStorage.getItem('lic_trial_count') || '0');
        this.loadHistory();
      }
      this.$nextTick(() => this.loadFromUrl());
    },

    // Essais restants pour le badge
    trialRemaining() {
      return Math.max(0, this.TRIAL_LIMIT - this.trialCount);
    },

    setLang(code) { this.lang = code; },

    t(key) {
      return (translations[this.lang] || translations['fr'])[key] ?? translations['fr'][key] ?? key;
    },

    fmt(n) {
      if (n == null) return '';
      return Math.round(n).toLocaleString('fr-MA');
    },

    nextStep() { this.wizardStep = Math.min(this.wizardStep + 1, 6); },
    prevStep() { this.wizardStep = Math.max(this.wizardStep - 1, 1); },

    // ─── DATE D'EMBAUCHE → ancienneté automatique ─────────────────────────────
    updateSeniorityFromDate() {
      if (!this.form.hireDate) return;
      const hire = new Date(this.form.hireDate);
      const end = this.form.endDate ? new Date(this.form.endDate) : new Date();
      let y = end.getFullYear() - hire.getFullYear();
      const m = end.getMonth() - hire.getMonth();
      if (m < 0 || (m === 0 && end.getDate() < hire.getDate())) y--;
      this.form.seniority = Math.max(1, Math.max(0, y));
    },

    hireDateLabel() {
      if (!this.form.hireDate) return '';
      const hire = new Date(this.form.hireDate);
      const end = this.form.endDate ? new Date(this.form.endDate) : new Date();
      let y = end.getFullYear() - hire.getFullYear();
      let m = end.getMonth() - hire.getMonth();
      if (end.getDate() < hire.getDate()) m--;
      if (m < 0) { y--; m += 12; }
      const isAr = this.lang === 'ar';
      const yStr = y > 0 ? (isAr ? `${y} سنة` : `${y} an${y > 1 ? 's' : ''}`) : '';
      const mStr = m > 0 ? (isAr ? ` و ${m} شهر` : ` et ${m} mois`) : '';
      return (yStr + mStr) || (isAr ? 'أقل من شهر' : 'Moins d\'1 mois');
    },

    // ─── WIZARD OPTIONS ──────────────────────────────────────────────────────
    dismissalOptions() {
      const d = {
        fr: [
          { value:'faute_grave',     icon:'🚨', label:'Faute grave',             desc:'Vol, violence, ivresse, absence injustifiée...', badge:'Pas d\'indemnité', badgeClass:'bg-red-500/15 text-red-400' },
          { value:'faute_non_grave', icon:'⚠️', label:'Faute non grave',         desc:'Insuffisance pro, faute légère répétée...',       badge:'Indemnité légale', badgeClass:'bg-orange-500/15 text-orange-400' },
          { value:'economique',      icon:'📉', label:'Licenciement économique',  desc:'Restructuration, difficultés économiques...',     badge:'Autorisation requise', badgeClass:'bg-blue-500/15 text-blue-400' },
          { value:'abusif',          icon:'⚖️', label:'Licenciement abusif',      desc:'Sans motif valable ou sans procédure légale',     badge:'D&I + Indemnité', badgeClass:'bg-purple-500/15 text-purple-400' },
        ],
        ar: [
          { value:'faute_grave',     icon:'🚨', label:'خطأ جسيم',              desc:'سرقة، عنف، سكر، غياب غير مبرر...', badge:'بدون تعويض', badgeClass:'bg-red-500/15 text-red-400' },
          { value:'faute_non_grave', icon:'⚠️', label:'خطأ غير جسيم',         desc:'قصور مهني، خطأ بسيط متكرر...',     badge:'تعويض قانوني', badgeClass:'bg-orange-500/15 text-orange-400' },
          { value:'economique',      icon:'📉', label:'فصل اقتصادي',           desc:'إعادة هيكلة، صعوبات اقتصادية...',  badge:'إذن مسبق مطلوب', badgeClass:'bg-blue-500/15 text-blue-400' },
          { value:'abusif',          icon:'⚖️', label:'فصل تعسفي',             desc:'بدون سبب مشروع أو بدون إجراءات', badge:'تعويضات الضرر + قانوني', badgeClass:'bg-purple-500/15 text-purple-400' },
        ],
      };
      return d[this.lang] || d['fr'];
    },

    categoryOptions() {
      const d = {
        fr: [
          { value:'cadre',    icon:'👔', label:'Cadre',    desc:'Préavis 1-3 mois' },
          { value:'employe',  icon:'💼', label:'Employé',  desc:'Préavis 8j - 2 mois' },
          { value:'ouvrier',  icon:'🔧', label:'Ouvrier',  desc:'Préavis 8j - 1 mois' },
        ],
        ar: [
          { value:'cadre',    icon:'👔', label:'إطار',    desc:'إشعار مسبق 1-3 أشهر' },
          { value:'employe',  icon:'💼', label:'موظف',   desc:'إشعار 8 أيام - شهران' },
          { value:'ouvrier',  icon:'🔧', label:'عامل',   desc:'إشعار 8 أيام - شهر' },
        ],
      };
      return d[this.lang] || d['fr'];
    },

    baremeRows() {
      const d = {
        fr: [
          { years:'1 – 5 ans',    rate:'96h / an' },
          { years:'6 – 10 ans',   rate:'144h / an' },
          { years:'11 – 15 ans',  rate:'192h / an' },
          { years:'> 15 ans',     rate:'240h / an' },
        ],
        ar: [
          { years:'1 – 5 سنوات',  rate:'96 ساعة / سنة' },
          { years:'6 – 10 سنوات', rate:'144 ساعة / سنة' },
          { years:'11 – 15 سنة',  rate:'192 ساعة / سنة' },
          { years:'> 15 سنة',     rate:'240 ساعة / سنة' },
        ],
      };
      return d[this.lang] || d['fr'];
    },

    // ─── CALCULATOR ──────────────────────────────────────────────────────────
    calculateAndNext() {
      // Vérification quota invité
      if (this.isGuest && this.trialCount >= this.TRIAL_LIMIT) {
        this.showTrialWall = true;
        return;
      }

      const { salary, seniority, category, type, secteur, isDelegate } = this.form;
      if (!salary || seniority < 1) return;

      const heuresBase = secteur === 'SMAG' ? 191 : 208;
      const salaireHoraire = salary / heuresBase;
      let breakdown = [];
      let indemniteLegale = 0;

      if (type !== 'faute_grave') {
        const tranches = [
          { from:1, to:5,        rate:96  },
          { from:6, to:10,       rate:144 },
          { from:11, to:15,      rate:192 },
          { from:16, to:Infinity,rate:240 },
        ];
        for (const tr of tranches) {
          if (seniority < tr.from) break;
          const years = Math.min(seniority, tr.to === Infinity ? seniority : tr.to) - tr.from + 1;
          const amount = salaireHoraire * tr.rate * years;
          const toStr = tr.to === Infinity ? '+' : `–${tr.to}`;
          const label = this.lang === 'ar'
            ? `${tr.from}${toStr} سنة × ${tr.rate} ساعة`
            : `Années ${tr.from}${toStr} × ${tr.rate}h`;
          const formula = this.lang === 'ar'
            ? `${years} سنة × ${tr.rate}س × ${this.fmt(salaireHoraire)} MAD/h`
            : `${years} an${years > 1 ? 's' : ''} × ${tr.rate}h × ${this.fmt(salaireHoraire)} MAD/h`;
          breakdown.push({ label, amount, formula });
          indemniteLegale += amount;
        }
      }

      // Préavis
      let preavismois = 0;
      if (type !== 'faute_grave') {
        if (category === 'cadre') {
          preavismois = seniority < 1 ? 1 : seniority <= 5 ? 2 : 3;
        } else if (category === 'employe') {
          preavismois = seniority < 1 ? 8/30 : seniority <= 5 ? 1 : 2;
        } else {
          preavismois = seniority <= 5 ? 8/30 : 1;
        }
      }
      const jours = Math.round(preavismois * 30);
      const preavislabel = this.lang === 'ar'
        ? (jours >= 25 ? `${Math.round(preavismois)} شهر` : `${jours} يوم`)
        : (jours >= 25 ? `${Math.round(preavismois)} mois` : `${jours} jours`);
      const indemnitePreavis = salary * preavismois;

      // D&I abusif (Art. 41)
      const dommages = type === 'abusif'
        ? Math.min(salary * 1.5 * seniority, salary * 36) : 0;

      // Salaires non payés + congés non pris (Art. 247)
      const salaireJournalier = salary / 26;
      const unpaidDays = this.form.unpaidDays || 0;
      const unusedLeave = this.form.unusedLeave || 0;
      const unpaidAmount = unpaidDays * salaireJournalier;
      const leaveAmount = unusedLeave * salaireJournalier;

      const total = indemniteLegale + indemnitePreavis + dommages + unpaidAmount + leaveAmount;

      // Seniority label
      const seniorityLabel = this.lang === 'ar' ? `${seniority} سنة` : `${seniority} ans`;

      // Formules détaillées
      const salaireHoraireFormula = `${this.fmt(salary)} ÷ ${heuresBase}h (${secteur}) = ${this.fmt(salaireHoraire)} MAD/h`;
      const preFormula = this.lang === 'ar'
        ? `${jours >= 25 ? Math.round(preavismois) + ' شهر' : jours + ' يوم'} × ${this.fmt(salary)} درهم`
        : `${jours >= 25 ? Math.round(preavismois) + ' mois' : jours + ' jours'} × ${this.fmt(salary)} MAD`;
      const plafonne = type === 'abusif' && (salary * 1.5 * seniority > salary * 36);
      const domFormula = type === 'abusif'
        ? (this.lang === 'ar'
          ? `${seniority} سنة × 1.5 × ${this.fmt(salary)} درهم${plafonne ? ' (محدود بـ 36 شهراً)' : ''}`
          : `${seniority} ans × 1,5 × ${this.fmt(salary)} MAD${plafonne ? ' (plafonné 36 mois)' : ''}`)
        : '';

      // Formules complémentaires
      const unpaidFormula = this.lang === 'ar'
        ? `${unpaidDays} يوم × ${this.fmt(salaireJournalier)} درهم/يوم`
        : `${unpaidDays} jours × ${this.fmt(salaireJournalier)} MAD/jour`;
      const leaveFormula = this.lang === 'ar'
        ? `${unusedLeave} يوم × ${this.fmt(salaireJournalier)} درهم/يوم`
        : `${unusedLeave} jours × ${this.fmt(salaireJournalier)} MAD/jour`;

      this.results = {
        salaireHoraire, salaireHoraireFormula,
        salaireJournalier,
        breakdown,
        indemniteLegale,
        indemnitePreavis, preavislabel, preFormula,
        dommages, domFormula,
        unpaidDays, unpaidAmount, unpaidFormula,
        unusedLeave, leaveAmount, leaveFormula,
        total, seniorityLabel,
      };
      this.wizardStep = 6;
      this.saveToHistory();

      // Incrémenter le compteur d'essais invité
      if (this.isGuest) {
        this.trialCount++;
        localStorage.setItem('lic_trial_count', String(this.trialCount));
      }
    },

    // ─── ① HISTORIQUE LOCALSTORAGE (isolé par utilisateur) ──────────────────
    _historyKey() {
      // Clé unique par utilisateur : lic_history_<uid>
      return this.currentUser ? `lic_history_${this.currentUser.id}` : 'lic_history_guest';
    },

    saveToHistory() {
      if (!this.results || this.form.type === 'faute_grave') return;
      const key = this._historyKey();
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      stored.unshift({
        id: Date.now(),
        date: new Date().toLocaleDateString('fr-MA'),
        type: this.form.type,
        category: this.form.category,
        seniority: this.form.seniority,
        salary: this.form.salary,
        secteur: this.form.secteur || 'SMIG',
        isDelegate: this.form.isDelegate || false,
        total: this.results.total,
      });
      const trimmed = stored.slice(0, 5);
      localStorage.setItem(key, JSON.stringify(trimmed));
      this.history = trimmed;
    },

    loadHistory() {
      const key = this._historyKey();
      this.history = JSON.parse(localStorage.getItem(key) || '[]');
    },

    restoreFromHistory(entry) {
      this.form.type = entry.type;
      this.form.category = entry.category;
      this.form.seniority = entry.seniority;
      this.form.salary = entry.salary;
      this.form.secteur     = entry.secteur || 'SMIG';
      this.form.isDelegate  = entry.isDelegate || false;
      this.calculateAndNext();
      this.activeTab = 'calc';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    clearHistory() {
      const key = this._historyKey();
      localStorage.removeItem(key);
      this.history = [];
      this.showHistory = false;
    },

    // ─── ⑤ DOSSIERS SUPABASE (cross-device) ──────────────────────────────────
    async saveDossier() {
      if (this.isGuest) { this.showTrialWall = true; return; }
      if (!this.results || !this.currentUser) return;
      this.savingDossier = true;
      const payload = {
        nom_salarie: this.dossier.nomSalarie || null,
        poste:       this.dossier.poste || null,
        ref:         this.dossier.ref || null,
        type:        this.form.type,
        category:    this.form.category,
        seniority:   this.form.seniority,
        salary:      this.form.salary,
        total:       Math.round(this.results.total),
        status:      'draft',
        data: {
          form: { ...this.form },
          dossier: { ...this.dossier },
        },
      };
      const { error } = await sb.from('dossiers').insert(payload);
      this.savingDossier = false;
      if (error) {
        console.error('saveDossier', error);
        alert(this.t('dossier_save_error') + '\n' + error.message);
        return;
      }
      this.dossierSaved = true;
      setTimeout(() => { this.dossierSaved = false; }, 2500);
      this.loadDossiers();
    },

    async loadDossiers() {
      if (!this.currentUser) return;
      this.loadingDossiers = true;
      const { data, error } = await sb
        .from('dossiers')
        .select('*')
        .order('created_at', { ascending: false });
      this.loadingDossiers = false;
      if (error) { console.error('loadDossiers', error); return; }
      this.dossiers = data || [];
    },

    async deleteDossier(id) {
      if (!confirm(this.t('dossier_delete_confirm'))) return;
      const { error } = await sb.from('dossiers').delete().eq('id', id);
      if (error) { console.error('deleteDossier', error); return; }
      this.dossiers = this.dossiers.filter(d => d.id !== id);
    },

    async cycleDossierStatus(d) {
      const order = ['draft', 'in_progress', 'closed'];
      const next = order[(order.indexOf(d.status) + 1) % order.length];
      const { error } = await sb.from('dossiers').update({ status: next }).eq('id', d.id);
      if (error) { console.error('status', error); return; }
      d.status = next;
    },

    restoreDossier(d) {
      const f = d.data?.form || {};
      this.form.type        = d.type;
      this.form.category    = d.category;
      this.form.seniority   = d.seniority;
      this.form.salary      = d.salary;
      this.form.hireDate    = f.hireDate || '';
      this.form.endDate     = f.endDate || '';
      this.form.unpaidDays  = f.unpaidDays || 0;
      this.form.unusedLeave = f.unusedLeave || 0;
      this.form.secteur     = f.secteur || 'SMIG';
      this.form.isDelegate  = f.isDelegate || false;
      this.dossier = d.data?.dossier || {
        nomSalarie: d.nom_salarie || '', poste: d.poste || '', ref: d.ref || '',
      };
      this.calculateAndNext();
      this.activeTab = 'calc';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Liste filtrée + triée
    filteredDossiers() {
      let list = this.dossiers;

      // Filtre statut
      if (this.dossierStatusFilter !== 'all') {
        list = list.filter(d => d.status === this.dossierStatusFilter);
      }

      // Recherche texte (nom, poste, réf)
      const q = this.dossierSearch.trim().toLowerCase();
      if (q) {
        list = list.filter(d =>
          (d.nom_salarie || '').toLowerCase().includes(q) ||
          (d.poste || '').toLowerCase().includes(q) ||
          (d.ref || '').toLowerCase().includes(q)
        );
      }

      // Tri
      list = [...list];
      if (this.dossierSort === 'recent')      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      else if (this.dossierSort === 'old')    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      else if (this.dossierSort === 'amount')  list.sort((a, b) => (b.total || 0) - (a.total || 0));
      else if (this.dossierSort === 'name')    list.sort((a, b) => (a.nom_salarie || '').localeCompare(b.nom_salarie || ''));

      return list;
    },

    // Budget des dossiers affichés (filtrés)
    dossiersBudget() {
      return this.filteredDossiers().reduce((sum, d) => sum + (d.total || 0), 0);
    },

    // Compteur par statut (pour les chips)
    statusCount(status) {
      if (status === 'all') return this.dossiers.length;
      return this.dossiers.filter(d => d.status === status).length;
    },

    dossierStatusLabel(status) {
      const map = {
        fr: { draft: 'Brouillon', in_progress: 'En cours', closed: 'Clôturé' },
        ar: { draft: 'مسودة',     in_progress: 'قيد المعالجة', closed: 'مغلق' },
      };
      return (map[this.lang] || map.fr)[status] || status;
    },

    dossierDate(d) {
      return new Date(d.created_at).toLocaleDateString(this.lang === 'ar' ? 'ar-MA' : 'fr-MA');
    },

    // ─── ② PARTAGE PAR URL ───────────────────────────────────────────────────
    shareUrl() {
      const params = new URLSearchParams({
        t: this.form.type || '',
        c: this.form.category || '',
        s: this.form.seniority || '',
        sal: this.form.salary || '',
      });
      const url = `${location.origin}${location.pathname}?${params}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          this.copiedUrl = true;
          setTimeout(() => { this.copiedUrl = false; }, 2500);
        });
      } else {
        prompt(this.t('share_copy_prompt'), url);
      }
    },

    loadFromUrl() {
      const p = new URLSearchParams(location.search);
      const t = p.get('t'), c = p.get('c'),
            s = parseInt(p.get('s')), sal = parseFloat(p.get('sal'));
      if (t && c && s > 0 && sal > 0) {
        this.form.type = t;
        this.form.category = c;
        this.form.seniority = s;
        this.form.salary = sal;
        this.calculateAndNext();
        window.history.replaceState({}, '', location.pathname);
      }
    },

    // ─── ③ CALCULATEUR DE DATES ──────────────────────────────────────────────
    calculateDates() {
      if (!this.dateForm.notifDate || !this.dateForm.category) return;
      const notif = new Date(this.dateForm.notifDate);
      const { category, seniority, type } = this.dateForm;
      const isFaute = type === 'faute_grave';

      let preavismois = 0;
      if (!isFaute) {
        if (category === 'cadre')        preavismois = seniority < 1 ? 1 : seniority <= 5 ? 2 : 3;
        else if (category === 'employe') preavismois = seniority < 1 ? 8/30 : seniority <= 5 ? 1 : 2;
        else                             preavismois = seniority <= 5 ? 8/30 : 1;
      }
      const preavisdays = Math.round(preavismois * 30);

      const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
      const today = new Date(); today.setHours(0,0,0,0);
      const isAr = this.lang === 'ar';

      const fmtDate = d => d.toLocaleDateString(isAr ? 'ar-MA' : 'fr-MA', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
      const left = d => Math.ceil((d - today) / 86400000);

      const badge = d => {
        const n = left(d);
        if (n < 0)  return { text: isAr ? `تأخير ${-n} يوم` : `Passé depuis ${-n}j`,    cls: 'text-red-400 bg-red-500/10 border-red-500/20' };
        if (n === 0) return { text: isAr ? 'اليوم !' : "Aujourd'hui !",                   cls: 'text-red-400 bg-red-500/10 border-red-500/20' };
        if (n <= 7)  return { text: isAr ? `خلال ${n} أيام` : `Dans ${n}j`,              cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
        return         { text: isAr ? `${n} يوم متبقٍ` : `Dans ${n} jours`,              cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      };

      const finPreavis   = add(notif, preavisdays);
      const depart       = isFaute ? notif : finPreavis;
      const limiteDaman  = add(depart, 30);
      const limiteRecours= add(notif, 90);

      this.dateResults = {
        steps: [
          { icon:'📋', label: isAr ? 'تاريخ الإشعار بالفصل'                           : 'Notification du licenciement',        date: fmtDate(notif),          badge: null,              highlight: true },
          ...(preavisdays > 0 ? [{ icon:'⏳', label: isAr ? `نهاية مهلة الإشعار (${preavisdays} يوم)` : `Fin du préavis (${preavisdays} jours)`, date: fmtDate(finPreavis), badge: badge(finPreavis), highlight: false }] : []),
          { icon:'📁', label: isAr ? 'تسليم وثائق نهاية العقد'                        : 'Remise des documents de fin contrat',  date: fmtDate(depart),         badge: badge(depart),     highlight: false },
          { icon:'🏢', label: isAr ? 'آخر أجل — تصريح Damancom (30 يوم)'             : 'Déclaration Damancom (30j après départ)', date: fmtDate(limiteDaman), badge: badge(limiteDaman),highlight: false },
          { icon:'⚖️', label: isAr ? 'آخر أجل — الطعن أمام المحكمة الاجتماعية (90 يوم)' : 'Délai de recours prud\'homal (90j)', date: fmtDate(limiteRecours), badge: badge(limiteRecours), highlight: false },
        ],
      };
    },

    // ─── ④ GÉNÉRATION PDF ────────────────────────────────────────────────────
    generatePDF() {
      if (this.isGuest) { this.showTrialWall = true; return; }
      if (!this.results || !window.jspdf) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      // ── Sanitizer : jsPDF (helvetica) ne supporte pas emojis / flèches / puces.
      //    On garde les accents français (é è à ç…), on remplace le reste. ──────
      const san = (s) => String(s)
        .replace(/[‒-―]/g, '-')        // tirets longs – — → -
        .replace(/→/g, '->')                 // flèche →
        .replace(/[•·]/g, '-')          // puces • ·
        .replace(/[‘’]/g, "'")          // apostrophes courbes ' '
        .replace(/[“”]/g, '"')          // guillemets courbes " "
        .replace(/í/g, 'i').replace(/Í/g, 'I')   // í/Í parasite → i/I
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️⃣]/gu, '') // emojis
        .replace(/[ \t]+$/g, '');                  // espaces de fin
      const T = (str, x, yy, opts) => doc.text(san(str), x, yy, opts);

      // ── Palette & constantes ─────────────────────────────────────────────────
      const G   = [15,  77,  58];   // vert marocain
      const GS  = [229, 242, 236];  // vert clair
      const GD  = [10,  55,  40];   // vert foncé
      const K   = [28,  32,  30];   // encre
      const M   = [100, 105, 102];  // gris muted
      const W   = [246, 243, 236];  // crème
      const L   = [225, 223, 215];  // ligne subtile
      const BG  = [252, 251, 248];  // fond léger

      const LM = 15, RM = 195, PW = 180;
      const now = new Date();
      const ref = this.dossier.ref || `IP${now.getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
      const dateStr = now.toLocaleDateString('fr-MA');
      const timeStr = now.toLocaleTimeString('fr-MA', { hour:'2-digit', minute:'2-digit' });

      // ── Helper : titre de section avec fond vert clair ───────────────────────
      const sectionTitle = (label, yy) => {
        doc.setFillColor(...GS);
        doc.roundedRect(LM, yy - 4.5, PW, 8, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...GD);
        T(label, LM + 4, yy);
        return yy + 10;
      };

      let y = 0;

      // ── En-tête ──────────────────────────────────────────────────────────────
      doc.setFillColor(...G);
      doc.rect(0, 0, 210, 36, 'F');
      doc.setFillColor(...GD);
      doc.rect(0, 34, 210, 2, 'F');

      // Logo IP blanc
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(LM, 9, 18, 16, 2.5, 2.5, 'F');
      doc.setTextColor(...G);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      T('IP', LM + 9, 19, { align: 'center' });

      // Titre + sous-titre
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      T('IndemnPro', LM + 22, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(190, 225, 210);
      T('Code du Travail Marocain — Loi 65-99', LM + 22, 26);

      // Réf + date
      doc.setTextColor(210, 235, 220);
      doc.setFontSize(8);
      T(`Ref. ${ref}`, RM, 17, { align: 'right' });
      T(`${dateStr}  ${timeStr}`, RM, 25, { align: 'right' });

      // Badge salarié protégé dans header
      if (this.form.isDelegate) {
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(LM, 29, 56, 5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        T('SALARIE PROTEGE - Art. 457', LM + 28, 33, { align: 'center' });
      }

      y = 44;

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

      // ── Sauvegarde ───────────────────────────────────────────────────────────
      const safeName = (this.dossier.nomSalarie || 'dossier').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      doc.save(`licenciement-${safeName}-${ref.toLowerCase()}.pdf`);
    },

    // ─── PROCEDURE STEPS ─────────────────────────────────────────────────────
    procedureSteps() {
      const standard = {
        fr: [
          { title:'Convocation à l\'entretien préalable', desc:'Lettre remise en main propre ou recommandée avec AR. Mentionner le motif envisagé et le droit d\'assistance.', badge:'48h minimum', warning:'Sans cette étape, le licenciement est nul de plein droit.', ref:'Art. 62 & 63 — Loi 65-99', delegate: false },
          { title:'Entretien préalable', desc:'Écouter les explications du salarié. Il peut se faire assister par un délégué du personnel. Rédiger un PV signé des deux parties.', badge:null, warning:null, ref:'Art. 62 — Loi 65-99', delegate: false },
          { title:'Notification écrite du licenciement', desc:'Lettre recommandée avec AR. Motif précis, circonstancié et non équivoque. À envoyer dans les 48h suivant l\'entretien.', badge:'48h maximum', warning:'Un motif vague peut être requalifié en licenciement abusif.', ref:'Art. 63 — Loi 65-99', delegate: false },
          { title:'Exécution du préavis', desc:'Le salarié continue à travailler sauf dispense de l\'employeur (avec maintien du salaire). Aucun préavis en cas de faute grave.', badge:null, warning:null, ref:'Art. 43-51 — Décret 2-04-469', delegate: false },
          { title:'Remise des documents de fin de contrat', desc:'Certificat de travail · Reçu pour solde de tout compte · Attestation CNSS · Formulaire IPE (indemnité perte d\'emploi)', badge:null, warning:null, ref:'Art. 72 — Loi 65-99', delegate: false },
          { title:'Déclaration de départ sur Damancom', desc:'Obligatoire dans les 30 jours. Permet au salarié d\'activer ses droits à l\'IPE (indemnité chômage).', badge:'30 jours max', warning:null, ref:'CNSS — Damancom.ma', delegate: false },
        ],
        ar: [
          { title:'الاستدعاء للمقابلة التمهيدية', desc:'رسالة مسلّمة باليد أو مضمونة مع إشعار بالاستلام. تتضمن السبب المزمع وحق الاستعانة بمساعد.', badge:'48 ساعة على الأقل', warning:'بدون هذه الخطوة، يُعدّ الفصل باطلاً بحكم القانون.', ref:'المادتان 62 و63 — قانون 65-99', delegate: false },
          { title:'المقابلة التمهيدية', desc:'الاستماع لتفسيرات الأجير. يحق له الاستعانة بممثل الأجراء. تحرير محضر موقع من الطرفين.', badge:null, warning:null, ref:'المادة 62 — قانون 65-99', delegate: false },
          { title:'الإخطار الكتابي بالفصل', desc:'رسالة مضمونة مع إشعار بالاستلام. سبب دقيق وملموس خلال 48 ساعة من المقابلة.', badge:'48 ساعة كحد أقصى', warning:'السبب الغامض قد يُعيد تصنيف الفصل إلى فصل تعسفي.', ref:'المادة 63 — قانون 65-99', delegate: false },
          { title:'تنفيذ مهلة الإشعار المسبق', desc:'يستمر الأجير في العمل إلا إذا أعفاه صاحب العمل مع استمرار الراتب. لا إشعار في حالة الخطأ الجسيم.', badge:null, warning:null, ref:'المواد 43-51 — المرسوم 2-04-469', delegate: false },
          { title:'تسليم وثائق نهاية العقد', desc:'شهادة العمل · إيصال تسوية الحساب الختامي · شهادة CNSS · استمارة التعويض عن فقدان الشغل (IPE)', badge:null, warning:null, ref:'المادة 72 — قانون 65-99', delegate: false },
          { title:'التصريح بالمغادرة على Damancom', desc:'إلزامي في أجل 30 يوماً. يتيح للأجير تفعيل حقوق التعويض عن فقدان الشغل.', badge:'30 يوماً كحد أقصى', warning:null, ref:'CNSS — Damancom.ma', delegate: false },
        ],
      };
      const delegateExtra = {
        fr: [
          { title:'🛡️ Saisine de l\'Inspection du Travail', desc:'Avant tout licenciement, l\'employeur doit demander l\'autorisation de l\'Inspecteur du Travail compétent. Cette étape est impérative et préalable à toute autre démarche.', badge:'OBLIGATOIRE', warning:'Sans cette autorisation, le licenciement est nul et de nul effet. Le délégué peut exiger sa réintégration.', ref:'Art. 457 — Loi 65-99', delegate: true },
          { title:'🛡️ Réponse de l\'Inspecteur du Travail', desc:'L\'inspecteur dispose d\'un délai pour statuer. En l\'absence de réponse dans le délai légal, l\'autorisation est considérée comme accordée. En cas de refus, le licenciement ne peut être prononcé.', badge:'Délai légal', warning:null, ref:'Art. 458 — Loi 65-99', delegate: true },
        ],
        ar: [
          { title:'🛡️ إخطار مفتشية الشغل', desc:'قبل أي فصل، يجب على صاحب العمل طلب إذن مفتش الشغل المختص. هذه الخطوة إلزامية وسابقة لأي إجراء آخر.', badge:'إلزامي', warning:'بدون هذا الإذن، يُعدّ الفصل باطلاً بطلاناً مطلقاً. يحق للمندوب المطالبة بإعادة الإدماج.', ref:'المادة 457 — قانون 65-99', delegate: true },
          { title:'🛡️ رد مفتش الشغل', desc:'يتوفر المفتش على أجل قانوني للبت في الطلب. في حالة عدم الرد داخل الأجل، يُعدّ الإذن ضمنياً ممنوحاً. في حالة الرفض، لا يمكن إصدار قرار الفصل.', badge:'الأجل القانوني', warning:null, ref:'المادة 458 — قانون 65-99', delegate: true },
        ],
      };
      const lang = this.lang in standard ? this.lang : 'fr';
      const steps = standard[lang].slice();
      if (this.form.isDelegate) {
        // Insérer les étapes délégué avant les étapes standard (au début)
        steps.unshift(...delegateExtra[lang]);
      }
      return steps;
    },

    // ─── DISMISSAL TYPES ─────────────────────────────────────────────────────
    dismissalTypes() {
      const d = {
        fr: [
          { id:'grave', icon:'🚨', color:'#ef4444', badge:'Faute grave', title:'Licenciement pour faute grave', desc:'Manquement grave rendant impossible le maintien dans l\'entreprise.', points:['Pas d\'indemnité légale','Pas de préavis','Rupture immédiate','Procédure préalable obligatoire'], warning:'L\'employeur doit prouver la faute. En cas de doute, le juge tranche en faveur du salarié.', ref:'Art. 39 & 61 — Loi 65-99' },
          { id:'non_grave', icon:'⚠️', color:'#f97316', badge:'Faute non grave', title:'Licenciement pour faute non grave', desc:'Insuffisance professionnelle, comportement répréhensible ou faute légère répétée.', points:['Indemnité légale obligatoire (Art. 52)','Préavis obligatoire','Procédure préalable requise','Motif précis obligatoire'], warning:null, ref:'Art. 52-63 — Loi 65-99' },
          { id:'economique', icon:'📉', color:'#3b82f6', badge:'Économique', title:'Licenciement économique', desc:'Suppression de poste pour raisons économiques, technologiques ou de restructuration.', points:['Autorisation de l\'Agent gouvernemental','Consultation des délégués du personnel','Indemnité légale obligatoire','Priorité de réembauche (1 an)'], warning:'Nécessite impérativement une autorisation administrative préalable.', ref:'Art. 66-71 — Loi 65-99' },
          { id:'abusif', icon:'⚖️', color:'#a855f7', badge:'Abusif', title:'Licenciement abusif', desc:'Sans motif valable ou sans respect de la procédure légale.', points:['Indemnité légale + D&I (Art. 41)','D&I = 1,5 mois/an plafonné 36 mois','Recours au tribunal du travail','Délai de recours : 90 jours'], warning:null, ref:'Art. 41 & 63 — Loi 65-99' },
        ],
        ar: [
          { id:'grave', icon:'🚨', color:'#ef4444', badge:'خطأ جسيم', title:'الفصل بسبب الخطأ الجسيم', desc:'مخالفة جسيمة تجعل استمرار العلاقة الشغلية مستحيلاً.', points:['لا تعويض قانونياً','لا إشعار مسبق','إنهاء فوري للعقد','الإجراء التمهيدي إلزامي'], warning:'على صاحب العمل إثبات الخطأ. في حالة الشك، يحكم القاضي لصالح الأجير.', ref:'المادتان 39 و61 — قانون 65-99' },
          { id:'non_grave', icon:'⚠️', color:'#f97316', badge:'خطأ غير جسيم', title:'الفصل بسبب خطأ غير جسيم', desc:'قصور مهني أو سلوك مذموم أو خطأ بسيط متكرر.', points:['تعويض قانوني إلزامي (المادة 52)','الإشعار المسبق إلزامي','الإجراء التمهيدي مطلوب','سبب دقيق إلزامي'], warning:null, ref:'المواد 52-63 — قانون 65-99' },
          { id:'economique', icon:'📉', color:'#3b82f6', badge:'اقتصادي', title:'الفصل لأسباب اقتصادية', desc:'إلغاء منصب عمل لأسباب اقتصادية أو تكنولوجية أو إعادة هيكلة.', points:['إذن العون الحكومي المكلف بالشغل','استشارة ممثلي الأجراء','تعويض قانوني إلزامي','أولوية إعادة التوظيف (سنة)'], warning:'يستلزم حتماً إذناً إدارياً مسبقاً.', ref:'المواد 66-71 — قانون 65-99' },
          { id:'abusif', icon:'⚖️', color:'#a855f7', badge:'تعسفي', title:'الفصل التعسفي', desc:'بدون سبب مشروع أو بدون احترام الإجراءات القانونية.', points:['تعويض قانوني + تعويضات ضرر (المادة 41)','التعويض = 1.5 شهر/سنة، بحد أقصى 36 شهراً','الطعن أمام المحكمة الاجتماعية','أجل الطعن: 90 يوماً'], warning:null, ref:'المادتان 41 و63 — قانون 65-99' },
        ],
      };
      return d[this.lang] || d['fr'];
    },

    fautesGraves() {
      const d = {
        fr: ['Délit portant atteinte à l\'honneur ou à la probité','Vol ou tentative de vol','Abus de confiance','Ivresse ou consommation de stupéfiants pendant le travail','Violence, voie de fait ou injures graves','Refus délibéré d\'exécuter un travail','Absence injustifiée > 4 jours ou 8 demi-journées / 12 mois','Dégradation volontaire des équipements','Faute causant un dommage matériel considérable','Inobservation grave des règles de sécurité','Incitation à la débauche','Divulgation de secret professionnel'],
        ar: ['جريمة ماسّة بالشرف أو النزاهة','السرقة أو محاولة السرقة','إساءة الثقة','السكر أو تعاطي المخدرات أثناء العمل','العنف أو الاعتداء أو الإهانة الجسيمة','الرفض المتعمد لتنفيذ عمل','غياب غير مبرر لأكثر من 4 أيام أو 8 أنصاف أيام / 12 شهراً','الإتلاف المتعمد للمعدات','خطأ يسبب ضرراً مادياً بالغاً','عدم احترام قواعد السلامة بشكل جسيم','التحريض على الفساد','إفشاء السر المهني'],
      };
      return d[this.lang] || d['fr'];
    },

    // ─── LEGAL REFS ──────────────────────────────────────────────────────────
    legalRefs() {
      const d = {
        fr: [
          { article:'Art. 39',  title:'Fautes graves',                 content:'Liste des fautes considérées comme graves justifiant un licenciement immédiat sans indemnité ni préavis.' },
          { article:'Art. 41',  title:'Dommages et intérêts',          content:'En cas de licenciement abusif : 1,5 mois de salaire par année d\'ancienneté, plafonné à 36 mois. Recours au tribunal du travail dans un délai de 90 jours.' },
          { article:'Art. 43',  title:'Obligation de préavis',         content:'Délai de préavis obligatoire sauf faute grave. Durée variable selon l\'ancienneté et la catégorie professionnelle.' },
          { article:'Art. 52',  title:'Barème de l\'indemnité',        content:'1-5 ans : 96h/an · 6-10 ans : 144h/an · 11-15 ans : 192h/an · > 15 ans : 240h/an. Calculée sur salaire horaire = salaire mensuel ÷ 191h.' },
          { article:'Art. 53',  title:'Base de calcul',                content:'Le salaire de référence est le plus favorable entre la moyenne des 52 dernières semaines et celle des 3 derniers mois.' },
          { article:'Art. 61',  title:'Procédure disciplinaire',       content:'Toute sanction doit être précédée d\'un entretien préalable. Le salarié a le droit d\'être informé et de se défendre.' },
          { article:'Art. 62',  title:'Entretien préalable',           content:'Convocation au moins 48h avant l\'entretien. Le salarié peut se faire assister par un délégué du personnel.' },
          { article:'Art. 63',  title:'Notification du licenciement',  content:'Décision notifiée par écrit dans les 48h suivant l\'entretien, avec mention du motif précis.' },
          { article:'Art. 66-71', title:'Licenciement économique',     content:'Soumis à l\'autorisation préalable de l\'agent gouvernemental chargé du travail, après consultation des délégués.' },
          { article:'Art. 72',  title:'Documents de fin de contrat',   content:'L\'employeur remet obligatoirement : certificat de travail, solde de tout compte, attestation CNSS.' },
          { article:'Décret 2-04-469', title:'Délais de préavis',      content:'Cadres : 1/2/3 mois. Employés : 8 jours/1 mois/2 mois. Ouvriers : 8 jours/8 jours/1 mois. Selon tranches < 1an / 1-5ans / > 5ans.' },
        ],
        ar: [
          { article:'المادة 39',       title:'الأخطاء الجسيمة',                content:'قائمة الأخطاء المعتبرة جسيمة والتي تبرر الفصل الفوري بدون تعويض ولا إشعار مسبق.' },
          { article:'المادة 41',       title:'تعويضات الضرر',                  content:'في حالة الفصل التعسفي: 1,5 شهر من الراتب عن كل سنة خدمة، بحد أقصى 36 شهراً. الطعن في أجل 90 يوماً.' },
          { article:'المادة 43',       title:'وجوب الإشعار المسبق',            content:'مهلة الإشعار المسبق إلزامية إلا في حالة الخطأ الجسيم. مدتها تختلف حسب الأقدمية والفئة المهنية.' },
          { article:'المادة 52',       title:'جدول التعويض',                   content:'1-5 سنوات: 96ساعة/سنة · 6-10: 144ساعة/سنة · 11-15: 192ساعة/سنة · أكثر من 15: 240ساعة/سنة. الأجر الساعي = الشهري ÷ 191.' },
          { article:'المادة 53',       title:'أساس الحساب',                    content:'يُحسب على أساس الأجر الإجمالي لآخر 52 أسبوعاً أو آخر 3 أشهر وفق الأفضل للأجير.' },
          { article:'المادة 61',       title:'الإجراء التأديبي',               content:'يجب أن تسبق كل عقوبة مقابلة تمهيدية. يحق للأجير الإعلام بالوقائع والدفاع عن نفسه.' },
          { article:'المادة 62',       title:'المقابلة التمهيدية',             content:'الاستدعاء قبل 48 ساعة على الأقل. يحق للأجير الاستعانة بممثل الأجراء.' },
          { article:'المادة 63',       title:'الإخطار بالفصل',                content:'القرار يُبلَّغ كتابةً في 48 ساعة من المقابلة مع ذكر السبب الدقيق.' },
          { article:'المواد 66-71',    title:'الفصل الاقتصادي',               content:'يخضع لإذن مسبق من العون الحكومي المكلف بالشغل بعد استشارة ممثلي الأجراء.' },
          { article:'المادة 72',       title:'وثائق نهاية العقد',              content:'يلتزم صاحب العمل بتسليم: شهادة العمل، تسوية الحساب الختامي، شهادة CNSS.' },
          { article:'المرسوم 2-04-469', title:'مدد الإشعار المسبق',           content:'الأطر: 1/2/3 أشهر. الموظفون: 8أيام/شهر/شهران. العمال: 8أيام/8أيام/شهر. للشرائح <1سنة/1-5سنوات/>5سنوات.' },
        ],
      };
      return d[this.lang] || d['fr'];
    },

    resources() {
      return [
        { icon:'🌐', name:'Damancom.ma',          desc:'Déclarations CNSS en ligne' },
        { icon:'🏥', name:'macnss.cnss.ma',        desc:'Attestations & droits personnels' },
        { icon:'👔', name:'emploi.gov.ma',          desc:'Portail officiel ANAPEC' },
        { icon:'⚖️', name:'Inspection du Travail', desc:'Réclamations & médiation' },
        { icon:'🏛️', name:'Tribunal du Travail',   desc:'Recours judiciaires (90j)' },
        { icon:'📑', name:'Loi 65-99',             desc:'Code du travail marocain complet' },
      ];
    },

  };
}

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const translations = {
  fr: {
    app_title: 'IndemnPro',
    app_sub: 'Code du Travail Marocain — Loi 65-99',
    nav_calc: 'Calculateur',
    nav_procedure: 'Procédure',
    nav_types: 'Types',
    nav_refs: 'Références',
    nav_docs: 'Documents',
    calc_title: 'Calculateur d\'indemnités',
    calc_title_pre: 'Le calcul d\'indemnités',
    calc_title_em: 'fait droit.',
    calc_sub: 'Estimez vos droits en 4 étapes simples — conforme à la Loi 65-99.',
    procedure_title_pre: 'Du dossier au PDF,',
    procedure_title_em: 'en étapes claires.',
    types_title_pre: 'Tous les motifs,',
    types_title_em: 'cadrés par la loi.',
    refs_title_pre: 'Le Code du Travail,',
    refs_title_em: 'article par article.',
    dates_title_pre: 'Calculateur',
    dates_title_em: 'de délais légaux.',
    step0_title: 'Dans quel secteur travaille le salarié ?',
    step0_sub: 'Le secteur détermine la base de calcul du taux horaire',
    step1_title: 'Quel est le type de licenciement ?',
    step1_sub: 'Sélectionnez la situation qui correspond à votre cas',
    step2_title: 'Quelle est votre catégorie professionnelle ?',
    step2_sub: 'Cela détermine votre délai de préavis',
    step3_title: 'Quelle est votre ancienneté ?',
    step3_sub: 'Nombre d\'années complètes dans l\'entreprise',
    step4_title: 'Quel est votre salaire brut mensuel ?',
    step4_sub: 'Indiquez votre salaire de base en dirhams',
    years_label: 'années d\'ancienneté',
    year_short: 'ans',
    seniority_placeholder: 'Ou saisissez directement...',
    salary_placeholder: 'Ex: 5000',
    equiv_hourly: 'Soit environ',
    smig_ref: 'SMIG 2026 : 3 422,72 MAD brut (17,92 MAD/h)',
    secteur_label: 'Secteur d\'activité',
    secteur_smig: 'Non agricole (SMIG)',
    secteur_smig_desc: '208h / mois · Industrie, commerce, services',
    secteur_smag: 'Agricole (SMAG)',
    secteur_smag_desc: '191h / mois · Agriculture, sylviculture, élevage',
    delegate_question: 'Ce salarié est-il délégué du personnel ?',
    delegate_yes: 'Oui, c\'est un délégué du personnel',
    delegate_yes_desc: 'Élu ou désigné — protection spéciale Art. 457-470',
    delegate_no: 'Non, salarié ordinaire',
    delegate_no_desc: 'Pas de mandat de représentation du personnel',
    delegate_warning_title: '⚠️ Salarié protégé — procédure renforcée',
    delegate_warning_body: 'Le licenciement d\'un délégué du personnel nécessite une autorisation préalable de l\'Inspecteur du Travail (Art. 457). Sans cette autorisation, le licenciement est nul et le salarié peut exiger sa réintégration.',
    delegate_grave_title: '🚨 Attention — Faute grave + Délégué du personnel',
    delegate_grave_body: 'Même en cas de faute grave, le licenciement d\'un délégué est soumis à autorisation de l\'Inspection du Travail. La procédure est plus stricte et le risque de nullité est élevé. Consultez impérativement un juriste.',
    delegate_badge: 'Salarié protégé',
    back: 'Retour',
    next: 'Suivant',
    calculate: 'Calculer mes indemnités',
    results_title: 'Vos indemnités estimées',
    total: 'Total estimé brut',
    legal_indemnity: 'Indemnité légale (Art. 52)',
    notice_indemnity: 'Indemnité de préavis',
    damages: 'Dommages et intérêts (Art. 41)',
    damages_ref: '1,5 mois × ancienneté, plafonné à 36 mois',
    faute_grave_warning_title: 'Aucune indemnité pour faute grave',
    faute_grave_warning: 'En cas de faute grave avérée (Art. 39), l\'employeur n\'est pas tenu de verser d\'indemnité légale ni de préavis. La procédure préalable reste obligatoire.',
    faute_grave_ref: 'Art. 39 & 61 — Loi 65-99',
    disclaimer: '⚠️ Ces estimations sont indicatives et basées sur le salaire brut de base. La base réelle peut inclure certaines primes. Consultez un avocat pour votre situation spécifique.',
    restart: '← Recommencer le calcul',
    print: 'Imprimer',
    bareme_title: 'Barème légal — Art. 52',
    cadre: 'Cadre',
    employe: 'Employé',
    ouvrier: 'Ouvrier',
    label_faute_grave: 'Faute grave',
    label_faute_non_grave: 'Faute non grave',
    label_economique: 'Économique',
    label_abusif: 'Abusif',
    procedure_title: 'Procédure de licenciement',
    procedure_sub: 'Étapes obligatoires sous peine de nullité',
    preavis_title: 'Délais de préavis légaux',
    preavis_cat: 'Catégorie',
    preavis_less1: '< 1 an',
    preavis_1_5: '1 – 5 ans',
    preavis_more5: '> 5 ans',
    '1mois': '1 mois',
    '2mois': '2 mois',
    '3mois': '3 mois',
    '8jours': '8 jours',
    preavis_ref: 'Source : Décret 2-04-469 du Code du Travail marocain',
    types_title: 'Types de licenciement',
    fautes_graves_title: 'Liste des fautes graves (Art. 39)',
    fautes_graves_ref: 'Source : Art. 39 — Loi 65-99, Code du Travail Marocain',
    refs_title: 'Références légales',
    resources_title: 'Ressources officielles',
    docs_title: 'Documents types',
    docs_sub: 'Modèles conformes au Code du Travail marocain',
    footer: '⚖️ Basé sur la Loi 65-99 (Code du Travail Marocain) · À titre indicatif uniquement · Consultez un avocat pour toute situation particulière.',
    // Dossiers Supabase
    nav_dossiers: 'Mes dossiers',
    dossiers_title_pre: 'Vos dossiers',
    dossiers_title_em: 'en un coup d\'œil.',
    dossiers_sub: 'Tous vos calculs sauvegardés, accessibles depuis n\'importe quel poste.',
    dossiers_empty_title: 'Aucun dossier sauvegardé',
    dossiers_empty_sub: 'Lancez un calcul puis cliquez sur « Sauvegarder le dossier » pour le retrouver ici.',
    dossiers_empty_cta: 'Nouveau calcul',
    dossiers_count: 'dossiers',
    dossiers_budget: 'Budget total provisionné',
    dossier_save_btn: 'Sauvegarder le dossier',
    dossier_saved: '✓ Dossier sauvegardé',
    dossier_save_error: 'Erreur lors de la sauvegarde du dossier.',
    dossier_delete_confirm: 'Supprimer ce dossier définitivement ?',
    dossier_open: 'Ouvrir',
    dossier_unnamed: 'Sans nom',
    dossier_search_ph: 'Rechercher un salarié, poste, référence…',
    filter_all: 'Tous',
    filter_draft: 'Brouillon',
    filter_in_progress: 'En cours',
    filter_closed: 'Clôturé',
    sort_recent: 'Plus récents',
    sort_old: 'Plus anciens',
    sort_amount: 'Montant ↓',
    sort_name: 'Nom A-Z',
    dossiers_no_match: 'Aucun dossier ne correspond à votre recherche.',
    dossiers_showing: 'affichés',
    // PDF
    pdf_btn: 'Télécharger PDF',
    dossier_opt: 'Optionnel',
    dossier_nom: 'Nom du salarié',
    dossier_nom_ph: 'Mohamed Benali',
    dossier_poste: 'Poste occupé',
    dossier_poste_ph: 'Responsable comptabilité',
    dossier_ref: 'Référence interne',
    dossier_ref_ph: 'LIC-2026-042',
    // Date d'embauche
    hire_date_label: 'Date de début de contrat',
    end_date_label: 'Date de licenciement (par défaut : aujourd\'hui)',
    hire_date_calculated: '→ Ancienneté :',
    hire_date_clear: 'Effacer les dates',
    // Compléments salaire
    unpaid_label: 'Jours travaillés non payés',
    unpaid_help: 'Salaires dus non versés',
    leave_label: 'Droit au congé non pris (en jours)',
    leave_help: 'Selon Art. 247 — Loi 65-99',
    unpaid_indemnity: 'Salaires non payés',
    leave_indemnity: 'Congés non pris',
    leave_ref: 'Art. 247 — Loi 65-99',
    daily_rate: 'Salaire journalier',
    // Détail calcul
    calc_hourly_rate: 'Taux horaire',
    // Historique
    nav_dates: 'Dates légales',
    history_title: '🕑 Calculs récents',
    history_empty: 'Aucun calcul sauvegardé',
    history_restore: 'Restaurer',
    history_clear: 'Vider l\'historique',
    history_total: 'Total',
    // Partage
    share_btn: '🔗 Partager le lien',
    share_copied: '✓ Lien copié !',
    share_copy_prompt: 'Copier ce lien :',
    // Calculateur dates
    dates_title: 'Calculateur de délais légaux',
    dates_sub: 'Entrez la date de notification pour visualiser toutes les échéances',
    dates_notif_label: 'Date de notification du licenciement',
    dates_category_label: 'Catégorie professionnelle',
    dates_seniority_label: 'Ancienneté (années)',
    dates_type_label: 'Type de licenciement',
    dates_calculate: 'Calculer les délais',
    dates_reset: 'Réinitialiser',
    dates_timeline_title: 'Échéancier légal',
  },
  ar: {
    app_title: 'IndemnPro',
    app_sub: 'قانون الشغل المغربي — 65-99',
    nav_calc: 'الحاسبة',
    nav_procedure: 'الإجراءات',
    nav_types: 'الأنواع',
    nav_refs: 'المراجع',
    nav_docs: 'الوثائق',
    calc_title: 'حاسبة تعويضات الفصل',
    calc_title_pre: 'حاسبة تعويضات الفصل',
    calc_title_em: 'وفق القانون.',
    calc_sub: 'احسب حقوقك في 4 خطوات بسيطة — مطابقة للقانون 65-99.',
    procedure_title_pre: 'من الملف إلى PDF،',
    procedure_title_em: 'بخطوات واضحة.',
    types_title_pre: 'جميع الأسباب،',
    types_title_em: 'وفق القانون.',
    refs_title_pre: 'قانون الشغل،',
    refs_title_em: 'مادة بمادة.',
    dates_title_pre: 'حاسبة',
    dates_title_em: 'الآجال القانونية.',
    step0_title: 'في أي قطاع يعمل الموظف ؟',
    step0_sub: 'القطاع يحدد أساس احتساب الأجر الساعي',
    step1_title: 'ما هو نوع الفصل ؟',
    step1_sub: 'اختر الوضعية التي تنطبق على حالتك',
    step2_title: 'ما هي فئتك المهنية ؟',
    step2_sub: 'هذا يحدد مدة إشعارك المسبق',
    step3_title: 'ما هي مدة أقدميتك ؟',
    step3_sub: 'عدد السنوات الكاملة في المؤسسة',
    step4_title: 'ما هو راتبك الإجمالي الشهري ؟',
    step4_sub: 'أدخل راتبك الأساسي بالدرهم',
    years_label: 'سنوات من الأقدمية',
    year_short: 'سنة',
    seniority_placeholder: 'أو أدخل مباشرة...',
    salary_placeholder: 'مثال: 5000',
    equiv_hourly: 'أي ما يعادل',
    smig_ref: 'الحد الأدنى للأجر 2026: 3 422,72 درهم إجمالي',
    secteur_label: 'قطاع النشاط',
    secteur_smig: 'غير فلاحي (SMIG)',
    secteur_smig_desc: '208 ساعة/شهر · صناعة، تجارة، خدمات',
    secteur_smag: 'فلاحي (SMAG)',
    secteur_smag_desc: '191 ساعة/شهر · فلاحة، غابات، تربية الماشية',
    delegate_question: 'هل هذا الأجير مندوب للأجراء ؟',
    delegate_yes: 'نعم، إنه مندوب للأجراء',
    delegate_yes_desc: 'منتخب أو معيّن — حماية خاصة المادة 457-470',
    delegate_no: 'لا، أجير عادي',
    delegate_no_desc: 'لا يشغل أي منصب تمثيلي',
    delegate_warning_title: '⚠️ أجير محمي — إجراء معزّز',
    delegate_warning_body: 'فصل مندوب الأجراء يستوجب إذناً مسبقاً من مفتش الشغل (المادة 457). بدون هذا الإذن، يُعدّ الفصل باطلاً ويحق للمندوب المطالبة بإعادة الإدماج.',
    delegate_grave_title: '🚨 تنبيه — خطأ جسيم + مندوب الأجراء',
    delegate_grave_body: 'حتى في حالة الخطأ الجسيم، يخضع فصل المندوب لإذن مفتشية الشغل. الإجراء أكثر صرامة وخطر البطلان مرتفع. يُنصح باستشارة مختص قانوني.',
    delegate_badge: 'أجير محمي',
    back: 'رجوع',
    next: 'التالي',
    calculate: 'احسب تعويضاتي',
    results_title: 'تعويضاتك المقدّرة',
    total: 'المجموع الإجمالي المقدّر',
    legal_indemnity: 'التعويض القانوني (المادة 52)',
    notice_indemnity: 'تعويض الإشعار المسبق',
    damages: 'تعويضات الضرر (المادة 41)',
    damages_ref: '1.5 شهر × الأقدمية، بحد أقصى 36 شهراً',
    faute_grave_warning_title: 'لا تعويض في حالة الخطأ الجسيم',
    faute_grave_warning: 'في حالة الخطأ الجسيم الثابت (المادة 39)، لا يلتزم صاحب العمل بأي تعويض عن الفصل ولا عن الإشعار المسبق. يبقى الإجراء التمهيدي إلزامياً.',
    faute_grave_ref: 'المادتان 39 و61 — قانون 65-99',
    disclaimer: '⚠️ هذه التقديرات استرشادية وتستند إلى الراتب الإجمالي الأساسي. يُنصح باستشارة محامٍ متخصص لحالتك الخاصة.',
    restart: 'إعادة الحساب →',
    print: 'طباعة',
    bareme_title: 'الجدول القانوني — المادة 52',
    cadre: 'إطار',
    employe: 'موظف',
    ouvrier: 'عامل',
    label_faute_grave: 'خطأ جسيم',
    label_faute_non_grave: 'خطأ غير جسيم',
    label_economique: 'اقتصادي',
    label_abusif: 'تعسفي',
    procedure_title: 'إجراءات الفصل من العمل',
    procedure_sub: 'خطوات إلزامية تحت طائلة البطلان',
    preavis_title: 'مدد الإشعار المسبق القانونية',
    preavis_cat: 'الفئة',
    preavis_less1: 'أقل من سنة',
    preavis_1_5: '1 – 5 سنوات',
    preavis_more5: 'أكثر من 5 سنوات',
    '1mois': 'شهر',
    '2mois': 'شهران',
    '3mois': '3 أشهر',
    '8jours': '8 أيام',
    preavis_ref: 'المصدر: المرسوم 2-04-469 من قانون الشغل المغربي',
    types_title: 'أنواع الفصل من العمل',
    fautes_graves_title: 'قائمة الأخطاء الجسيمة (المادة 39)',
    fautes_graves_ref: 'المصدر: المادة 39 — القانون 65-99، قانون الشغل المغربي',
    refs_title: 'المراجع القانونية',
    resources_title: 'الجهات الرسمية',
    docs_title: 'نماذج الوثائق',
    docs_sub: 'نماذج مطابقة لقانون الشغل المغربي',
    footer: '⚖️ مستند إلى القانون 65-99 (قانون الشغل المغربي) · للاستئناس فقط · استشر محامياً متخصصاً لأي حالة خاصة.',
    // Dossiers Supabase
    nav_dossiers: 'ملفاتي',
    dossiers_title_pre: 'ملفاتك',
    dossiers_title_em: 'في لمحة.',
    dossiers_sub: 'جميع حساباتك المحفوظة، متاحة من أي جهاز.',
    dossiers_empty_title: 'لا توجد ملفات محفوظة',
    dossiers_empty_sub: 'أنشئ حساباً ثم اضغط « حفظ الملف » لتجده هنا.',
    dossiers_empty_cta: 'حساب جديد',
    dossiers_count: 'ملفات',
    dossiers_budget: 'الميزانية الإجمالية المخصصة',
    dossier_save_btn: 'حفظ الملف',
    dossier_saved: '✓ تم حفظ الملف',
    dossier_save_error: 'خطأ أثناء حفظ الملف.',
    dossier_delete_confirm: 'حذف هذا الملف نهائياً ؟',
    dossier_open: 'فتح',
    dossier_unnamed: 'بدون اسم',
    dossier_search_ph: 'ابحث عن موظف، منصب، مرجع…',
    filter_all: 'الكل',
    filter_draft: 'مسودة',
    filter_in_progress: 'قيد المعالجة',
    filter_closed: 'مغلق',
    sort_recent: 'الأحدث',
    sort_old: 'الأقدم',
    sort_amount: 'المبلغ ↓',
    sort_name: 'الاسم أ-ي',
    dossiers_no_match: 'لا يوجد ملف يطابق بحثك.',
    dossiers_showing: 'معروض',
    // PDF
    pdf_btn: 'تحميل PDF',
    dossier_opt: 'اختياري',
    dossier_nom: 'اسم الموظف',
    dossier_nom_ph: 'محمد بنعلي',
    dossier_poste: 'المنصب',
    dossier_poste_ph: 'مسؤول المحاسبة',
    dossier_ref: 'المرجع الداخلي',
    dossier_ref_ph: 'LIC-2026-042',
    // Date d'embauche
    hire_date_label: 'تاريخ بداية العقد',
    end_date_label: 'تاريخ الفصل (افتراضياً : اليوم)',
    hire_date_calculated: '← الأقدمية :',
    hire_date_clear: 'مسح التواريخ',
    // Compléments salaire
    unpaid_label: 'أيام عمل غير مؤدّى عنها',
    unpaid_help: 'متأخرات الأجور غير المدفوعة',
    leave_label: 'العطلة المؤدى عنها غير المتمتع بها (بالأيام)',
    leave_help: 'حسب المادة 247 — قانون 65-99',
    unpaid_indemnity: 'الأجور غير المدفوعة',
    leave_indemnity: 'العطلة غير المتمتع بها',
    leave_ref: 'المادة 247 — قانون 65-99',
    daily_rate: 'الأجر اليومي',
    // Détail calcul
    calc_hourly_rate: 'الأجر الساعي',
    // Historique
    nav_dates: 'المواعيد القانونية',
    history_title: '🕑 الحسابات الأخيرة',
    history_empty: 'لا توجد حسابات محفوظة',
    history_restore: 'استعادة',
    history_clear: 'مسح التاريخ',
    history_total: 'المجموع',
    // Partage
    share_btn: '🔗 مشاركة الرابط',
    share_copied: '✓ تم نسخ الرابط !',
    share_copy_prompt: 'انسخ هذا الرابط :',
    // Calculateur dates
    dates_title: 'حاسبة الآجال القانونية',
    dates_sub: 'أدخل تاريخ الإشعار لعرض جميع المواعيد النهائية',
    dates_notif_label: 'تاريخ الإشعار بالفصل',
    dates_category_label: 'الفئة المهنية',
    dates_seniority_label: 'الأقدمية (سنوات)',
    dates_type_label: 'نوع الفصل',
    dates_calculate: 'احسب الآجال',
    dates_reset: 'إعادة تعيين',
    dates_timeline_title: 'جدول المواعيد القانونية',
  },
};
