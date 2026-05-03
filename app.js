function app() {
  return {
    lang: 'fr',
    darkMode: true,
    activeTab: 'calc',
    wizardStep: 1,
    results: null,
    openRef: null,
    form: { salary: null, seniority: 5, category: null, type: null },

    // ① Historique
    showHistory: false,
    history: [],

    // ② Partage URL
    copiedUrl: false,

    // ③ Calculateur de dates
    dateForm: { notifDate: '', category: null, seniority: 5, type: 'faute_non_grave' },
    dateResults: null,

    tabs: [
      { id: 'calc',      icon: '🧮', labelKey: 'nav_calc' },
      { id: 'procedure', icon: '📋', labelKey: 'nav_procedure' },
      { id: 'types',     icon: '📂', labelKey: 'nav_types' },
      { id: 'refs',      icon: '⚖️',  labelKey: 'nav_refs' },
      { id: 'dates',     icon: '📅', labelKey: 'nav_dates' },
    ],

    // Lifecycle — chargement initial
    init() {
      this.loadHistory();
      this.$nextTick(() => this.loadFromUrl());
    },

    setLang(code) { this.lang = code; },

    t(key) {
      return (translations[this.lang] || translations['fr'])[key] ?? translations['fr'][key] ?? key;
    },

    fmt(n) {
      if (n == null) return '';
      return Math.round(n).toLocaleString('fr-MA');
    },

    nextStep() { this.wizardStep = Math.min(this.wizardStep + 1, 5); },
    prevStep() { this.wizardStep = Math.max(this.wizardStep - 1, 1); },

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
      const { salary, seniority, category, type } = this.form;
      if (!salary || seniority < 1) return;

      const salaireHoraire = salary / 191;
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
          breakdown.push({ label, amount });
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

      const total = indemniteLegale + indemnitePreavis + dommages;

      // Seniority label
      const seniorityLabel = this.lang === 'ar' ? `${seniority} سنة` : `${seniority} ans`;

      this.results = { salaireHoraire, breakdown, indemniteLegale, indemnitePreavis, preavislabel, dommages, total, seniorityLabel };
      this.wizardStep = 5;
      this.saveToHistory();
    },

    // ─── ① HISTORIQUE LOCALSTORAGE ───────────────────────────────────────────
    saveToHistory() {
      if (!this.results || this.form.type === 'faute_grave') return;
      const stored = JSON.parse(localStorage.getItem('lic_history') || '[]');
      stored.unshift({
        id: Date.now(),
        date: new Date().toLocaleDateString('fr-MA'),
        type: this.form.type,
        category: this.form.category,
        seniority: this.form.seniority,
        salary: this.form.salary,
        total: this.results.total,
      });
      const trimmed = stored.slice(0, 5);
      localStorage.setItem('lic_history', JSON.stringify(trimmed));
      this.history = trimmed;
    },

    loadHistory() {
      this.history = JSON.parse(localStorage.getItem('lic_history') || '[]');
    },

    restoreFromHistory(entry) {
      this.form.type = entry.type;
      this.form.category = entry.category;
      this.form.seniority = entry.seniority;
      this.form.salary = entry.salary;
      this.calculateAndNext();
      this.activeTab = 'calc';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    clearHistory() {
      localStorage.removeItem('lic_history');
      this.history = [];
      this.showHistory = false;
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

    // ─── PROCEDURE STEPS ─────────────────────────────────────────────────────
    procedureSteps() {
      const d = {
        fr: [
          { title:'Convocation à l\'entretien préalable', desc:'Lettre remise en main propre ou recommandée avec AR. Mentionner le motif envisagé et le droit d\'assistance.', badge:'48h minimum', warning:'Sans cette étape, le licenciement est nul de plein droit.', ref:'Art. 62 & 63 — Loi 65-99' },
          { title:'Entretien préalable', desc:'Écouter les explications du salarié. Il peut se faire assister par un délégué du personnel. Rédiger un PV signé des deux parties.', badge:null, warning:null, ref:'Art. 62 — Loi 65-99' },
          { title:'Notification écrite du licenciement', desc:'Lettre recommandée avec AR. Motif précis, circonstancié et non équivoque. À envoyer dans les 48h suivant l\'entretien.', badge:'48h maximum', warning:'Un motif vague peut être requalifié en licenciement abusif.', ref:'Art. 63 — Loi 65-99' },
          { title:'Exécution du préavis', desc:'Le salarié continue à travailler sauf dispense de l\'employeur (avec maintien du salaire). Aucun préavis en cas de faute grave.', badge:null, warning:null, ref:'Art. 43-51 — Décret 2-04-469' },
          { title:'Remise des documents de fin de contrat', desc:'Certificat de travail · Reçu pour solde de tout compte · Attestation CNSS · Formulaire IPE (indemnité perte d\'emploi)', badge:null, warning:null, ref:'Art. 72 — Loi 65-99' },
          { title:'Déclaration de départ sur Damancom', desc:'Obligatoire dans les 30 jours. Permet au salarié d\'activer ses droits à l\'IPE (indemnité chômage).', badge:'30 jours max', warning:null, ref:'CNSS — Damancom.ma' },
        ],
        ar: [
          { title:'الاستدعاء للمقابلة التمهيدية', desc:'رسالة مسلّمة باليد أو مضمونة مع إشعار بالاستلام. تتضمن السبب المزمع وحق الاستعانة بمساعد.', badge:'48 ساعة على الأقل', warning:'بدون هذه الخطوة، يُعدّ الفصل باطلاً بحكم القانون.', ref:'المادتان 62 و63 — قانون 65-99' },
          { title:'المقابلة التمهيدية', desc:'الاستماع لتفسيرات الأجير. يحق له الاستعانة بممثل الأجراء. تحرير محضر موقع من الطرفين.', badge:null, warning:null, ref:'المادة 62 — قانون 65-99' },
          { title:'الإخطار الكتابي بالفصل', desc:'رسالة مضمونة مع إشعار بالاستلام. سبب دقيق وملموس خلال 48 ساعة من المقابلة.', badge:'48 ساعة كحد أقصى', warning:'السبب الغامض قد يُعيد تصنيف الفصل إلى فصل تعسفي.', ref:'المادة 63 — قانون 65-99' },
          { title:'تنفيذ مهلة الإشعار المسبق', desc:'يستمر الأجير في العمل إلا إذا أعفاه صاحب العمل مع استمرار الراتب. لا إشعار في حالة الخطأ الجسيم.', badge:null, warning:null, ref:'المواد 43-51 — المرسوم 2-04-469' },
          { title:'تسليم وثائق نهاية العقد', desc:'شهادة العمل · إيصال تسوية الحساب الختامي · شهادة CNSS · استمارة التعويض عن فقدان الشغل (IPE)', badge:null, warning:null, ref:'المادة 72 — قانون 65-99' },
          { title:'التصريح بالمغادرة على Damancom', desc:'إلزامي في أجل 30 يوماً. يتيح للأجير تفعيل حقوق التعويض عن فقدان الشغل.', badge:'30 يوماً كحد أقصى', warning:null, ref:'CNSS — Damancom.ma' },
        ],
      };
      return d[this.lang] || d['fr'];
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
    app_title: 'Moulinette Licenciement',
    app_sub: 'Code du Travail Marocain — Loi 65-99',
    nav_calc: 'Calculateur',
    nav_procedure: 'Procédure',
    nav_types: 'Types',
    nav_refs: 'Références',
    nav_docs: 'Documents',
    calc_title: 'Calculateur d\'indemnités',
    calc_sub: 'Estimez vos droits en 4 étapes simples',
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
    app_title: 'حاسبة إنهاء عقد العمل',
    app_sub: 'قانون الشغل المغربي — 65-99',
    nav_calc: 'الحاسبة',
    nav_procedure: 'الإجراءات',
    nav_types: 'الأنواع',
    nav_refs: 'المراجع',
    nav_docs: 'الوثائق',
    calc_title: 'حاسبة تعويضات الفصل',
    calc_sub: 'احسب حقوقك في 4 خطوات بسيطة',
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
