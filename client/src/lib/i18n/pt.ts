/**
 * O texto da interface em português.
 *
 * European / Mozambican Portuguese, not Brazilian: the school and its families
 * are in Mozambique. So "palavra-passe" rather than "senha", "turma" rather
 * than "classe", and the continuous is "a carregar" rather than "carregando".
 *
 * A child is "o seu educando" throughout, which is the register a Mozambican
 * school uses for the person an encarregado de educação is responsible for —
 * and it does not guess whether the child is a boy or a girl, which "o seu
 * filho" would.
 *
 * The same rule as en.ts, and it is the important one: nothing a teacher typed
 * appears here. Questions, titles, feedback, names and topics are shown exactly
 * as they were written.
 *
 * Every key English has must be here too. `Translation` in index.tsx enforces
 * it, so a forgotten line is a build error rather than a blank label a family
 * finds first.
 */

import type { Translation } from "./index";

export const pt: Translation = {
  languageName: "Português",

  common: {
    backToHome: "Voltar ao início",
    logout: "Terminar sessão",
    logOut: "Terminar sessão",
    loading: "A carregar…",
    password: "Palavra-passe",
    showPassword: "Mostrar palavra-passe",
    hidePassword: "Ocultar palavra-passe",
    checkConnection: "Verifique a sua ligação e tente novamente.",
    tagline: "Qualidade Sem Medida",
    language: "Idioma",
  },

  login: {
    loggedIn: "Sessão iniciada",
    loginFailed: "Não foi possível iniciar sessão",
    signIn: "Entrar",

    student: {
      title: "Iniciar sessão do Aluno",
      description: "Introduza o seu nome e a sua palavra-passe para aceder aos seus trabalhos",
      nameLabel: "O seu nome",
      namePlaceholder: "Introduza o seu nome",
      passwordPlaceholder: "Introduza a sua palavra-passe",
      scanCard: "Digitalizar cartão QR para entrar",
      cardNotRecognised: "Cartão não reconhecido. Peça ao seu professor para o verificar.",
      firstTime: "É a primeira vez? Introduza o seu nome tal como está registado e crie uma palavra-passe.",
      passwordSet: "A sua palavra-passe ficou definida. Use-a da próxima vez que entrar.",
      welcome: (firstName: string) => `Bem-vindo, ${firstName}`,
      welcomeBack: (fullName: string) => `Bem-vindo de volta, ${fullName}!`,
      invalidCredentials: "Dados de acesso incorretos",
      tryAgain: "Verifique o seu nome e a sua palavra-passe e tente novamente.",
    },

    teacher: {
      title: "Iniciar sessão do Professor",
      description: "Introduza os seus dados para aceder ao portal do professor",
      expired: "A sua sessão tinha expirado. Volte a entrar para continuar.",
      emailLabel: "Correio eletrónico",
      emailPlaceholder: "Introduza o seu correio eletrónico",
      passwordPlaceholder: "Introduza a sua palavra-passe",
      tryAgain: "Verifique o seu correio eletrónico e a sua palavra-passe e tente novamente.",
      loggedInAs: (fullName: string) => `Sessão iniciada como ${fullName}`,
    },

    parent: {
      title: "Iniciar sessão do Encarregado de Educação",
      description: "Introduza o nome de utilizador e a palavra-passe que a escola lhe deu",
      expired: "A sua sessão tinha expirado. Volte a entrar para continuar.",
      usernameLabel: "Nome de utilizador",
      usernamePlaceholder: "Introduza o seu nome de utilizador",
      passwordPlaceholder: "Introduza a sua palavra-passe",
      welcome: (fullName: string) => `Bem-vindo, ${fullName}.`,
      tryAgain: "Verifique o seu nome de utilizador e a sua palavra-passe e tente novamente.",
    },
  },

  studentDash: {
    portal: "Portal do Aluno",
    available: "Por fazer",
    handedIn: "Entregues",
    marked: "Corrigidos",
    averageScore: "Média",
    announcements: "Avisos",
    urgent: "Urgente",
    important: "Importante",

    treasureIsland: "Ilha do Tesouro",
    treasureIslandNote: "Junta os 12 tesouros terminando os teus trabalhos de casa.",
    penaltyShootout: "Marcação de Penáltis",
    penaltyShootoutNote: "Responde bem para marcar um penálti e para defender outro.",
    targetBlaster: "Acerta no Alvo",
    targetBlasterNote: "Toca no alvo certo antes que ele fuja. Ganha jogadas terminando os trabalhos de casa.",

    resources: "Recursos de Aprendizagem",
    resourcesNote: "Aceda a manuais e materiais de estudo",
    lessons: "Aulas em Vídeo e Áudio",
    lessonsNote: "Veja e ouça aulas gravadas",

    assignments: "Trabalhos por entregar",
    assignmentsNote: "Trabalhos à espera da sua entrega",
    late: "Atrasado",
    dueSoon: "Prazo a terminar",
    noHomework: "Não há trabalhos de casa para entregar de momento.",

    results: "Os seus resultados",
    resultsNote: "Trabalhos corrigidos, com comentários",
    viewResults: "Ver resultados",
    editSubmission: "Alterar entrega",
    awaitingReview: "À espera de correção",
    noResults: "Ainda não há resultados. Entregue um trabalho de casa para ver a sua primeira nota.",
    handedInOn: (date: string) => `Entregue em: ${date}`,
    assignmentFallback: "Trabalho",
    toComplete: "trabalhos por fazer",
    awaitingReviewNote: "à espera de correção",
    withFeedback: "com comentários",
    acrossAllMarked: "de todo o trabalho corrigido",
    overdue: "FORA DO PRAZO",
    dueOn: (date: string) => `Prazo: ${date}`,
    marks: (n: number) => (n === 1 ? "1 valor" : `${n} valores`),
  },

  teacherDash: {
    portal: "Portal do Professor",
    title: "Painel",
    subtitle: "Faça a gestão dos seus trabalhos e das entregas dos alunos",

    totalStudents: "Total de alunos",
    totalAssignments: "Total de trabalhos",
    pendingReview: "Por corrigir",
    marked: "Corrigidos",
    totalSubmissions: "Total de entregas",
    missingToday: "Entregas em falta hoje",
    missingTodayNote: "Com prazo hoje ou ontem — alunos que ainda não entregaram",

    resources: "Recursos de Aprendizagem",
    resourcesNote: "Faça a gestão de manuais, vídeos e planos de aula",
    lessons: "Aulas em Vídeo e Áudio",
    lessonsNote: "Carregue ou grave aulas para os alunos",
    students: "Gerir alunos",
    studentsNote: "Adicionar, alterar ou remover alunos",
    reports: "Relatórios e Análises",
    reportsNote: "Ver gráficos e acompanhar o progresso",
    gradeBook: "Pauta",
    gradeBookNote: "Acompanhar entregas e notas",
    exportData: "Exportar dados",
    exportDataNote: "Descarregar relatórios CSV filtrados",
    dailyReport: "Relatório diário",
    dailyReportNote: "Resumo de entregas pronto para o WhatsApp",
    reportCards: "Boletins",
    reportCardsNote: "Criar os boletins de um trimestre para uma turma",
    mostImproved: "Maior progresso",
    mostImprovedNote: "Premiar a maior subida numa disciplina",
    classSkills: "Competências da turma",
    classSkillsNote: "O que voltar a ensinar, e quem precisa de ajuda",
    questionBank: "Banco de Perguntas",
    questionBankNote: "Perguntas guardadas, prontas a reutilizar",
    gamePlays: "Jogos e trabalhos de casa",
    gamePlaysNote: "Quem está a ganhar as suas jogadas",
    postAnnouncement: "Publicar aviso",
    postAnnouncementNote: "Enviar avisos aos alunos",

    announcementFormNote: "Envie um aviso a todos os alunos ou a uma turma específica",
    announcementTitle: "Título",
    announcementTitlePlaceholder: "Título do aviso",
    announcementContent: "Conteúdo",
    announcementContentPlaceholder: "Escreva o seu aviso...",
    targetAudience: "Destinatários",
    allStudents: "Todos os alunos",
    onlyClass: (className: string) => `Apenas ${className}`,
    priority: "Prioridade",
    priorityUrgent: "Urgente",
    priorityImportant: "Importante",
    priorityNormal: "Normal",
    activeAnnouncements: "Avisos ativos",

    filterByClass: "Filtrar por turma",
    allClasses: "Todas as turmas",
    createAssignment: "Criar trabalho",
    createAnAssignment: "Criar um trabalho",
    draft: "Rascunho",
    draftNote: "Prontos a publicar — os alunos ainda não os veem",
    needsReview: "Por corrigir",
    archived: "Trabalhos arquivados",
    archivedNote: "Estes trabalhos estão escondidos da sua lista ativa",

    assignmentDeleted: "Trabalho eliminado",
    assignmentDeletedNote: "O trabalho foi removido com sucesso.",
    assignmentNotDeleted: "O trabalho não foi eliminado",
    assignmentNotUpdated: "O trabalho não foi atualizado",
    announcementPosted: "Aviso publicado",
    announcementPostedNote: "Os alunos já o conseguem ver.",
    announcementNotPosted: "O aviso não foi publicado",
    announcementDeleted: "Aviso eliminado",
    announcementNeedsBoth: "Escreva um título e o conteúdo antes de publicar.",
    assignmentArchived: "Trabalho arquivado",
    assignmentRestored: "Trabalho restaurado",

    assignments: "Trabalhos",
    assignmentsAll: "Os trabalhos que criou",
    assignmentsFor: (className: string) => `Trabalhos da ${className}`,
    pendingSubmissions: "Entregas por corrigir",
    pendingAll: "Entregas à espera da sua correção",
    pendingFor: (className: string) => `Entregas da ${className} à espera de correção`,
    forClass: (className: string) => `— ${className}`,
    assignmentCount: (n: number) => (n === 1 ? "1 trabalho" : `${n} trabalhos`),
    drafts: (n: number) => `Rascunhos (${n})`,
    archivedCount: (n: number) => `Trabalhos arquivados (${n})`,

    marks: (n: number) => (n === 1 ? "1 valor" : `${n} valores`),
    editDraft: "Editar rascunho",
    editAssignment: "Editar trabalho",
    deleteDraft: "Eliminar rascunho",
    deleteAssignment: "Eliminar trabalho",
    archiveAssignment: "Arquivar trabalho",
    movedToArchive: "O trabalho foi movido para o arquivo.",
    restoredToActive: "O trabalho foi devolvido aos trabalhos ativos.",
    noAssignments: "Ainda não há trabalhos",
    noAssignmentsFor: (className: string) => `Não há trabalhos para a ${className}`,
    nothingToMark: "Não há nada à espera de correção.",
    nothingToMarkFor: (className: string) => `Não há nada à espera de correção na ${className}.`,
    allOfClass: (className: string) => `Toda a ${className}`,
    studentCount: (n: number) => (n === 1 ? "1 aluno" : `${n} alunos`),
  },

  submit: {
    backToDashboard: "Voltar ao painel",
    instructions: "Instruções",
    chooseOne: "Escolha uma",
    yourAnswer: "A sua resposta",
    yourAnswerNumber: "A sua resposta (número)",
    typeNumber: "Escreva um número",
    typeShortAnswer: "Escreva uma resposta curta",
    typeAnswerHere: "Escreva aqui a sua resposta...",
    attachFiles: "Anexar ficheiros (fotografias do trabalho escrito à mão, PDF, documentos)",
    deadlinePassed: "Prazo terminado:",
    deadlinePassedNote: "O prazo já terminou, mas ainda pode entregar.",
    notFound: "Trabalho não encontrado",

    thinAnswersTitle: "Algumas respostas parecem incompletas",
    goBackImprove: "Voltar e melhorar",
    submitAnyway: "Entregar mesmo assim",

    notSaved: "Não foi guardado",
    notHandedIn: "Não foi entregue",
    checkForm: "Verifique o formulário e tente novamente.",

    handIn: "Entregar",
    handInAgain: "Entregar novamente",
    updateAnswers: "Atualizar respostas",
    handedIn: "Entregue",
    answersUpdated: "Respostas atualizadas",
    changesSaved: "As suas alterações foram guardadas.",
    teacherCanSee: "O seu professor já pode ver o seu trabalho.",

    thinAnswersIntro: (count: number) =>
      count === 1
        ? "A pergunta seguinte tem uma resposta muito curta. Os professores podem não conseguir dar a nota máxima a respostas muito breves."
        : "As perguntas seguintes têm respostas muito curtas. Os professores podem não conseguir dar a nota máxima a respostas muito breves.",
    thinQuestionNumber: (n: number) => `Pergunta ${n}`,
    thinCharacters: (chars: number) => (chars === 1 ? "1 carácter escrito" : `${chars} caracteres escritos`),
    thinMinimum: (minimum: number) => `(recomenda-se um mínimo de ${minimum})`,
    thinFooter: "Pode voltar atrás e acrescentar mais pormenor, ou entregar assim mesmo se já tiver carregado uma fotografia do seu trabalho.",

    true: "Verdadeiro",
    false: "Falso",
    uploading: "A carregar...",
    dropFilesHere: "Largue aqui os ficheiros",
    dragAndDrop: "Arraste e largue, ou toque — imagens, PDF, documentos",
    canRetryQuiz: "Já respondeu a este questionário. Altere as suas respostas e entregue novamente para ter uma nota nova na hora.",
    alreadyMarked: "Este trabalho já foi corrigido. Já não pode fazer alterações.",
    canStillChange: "Já entregou este trabalho. Pode alterar as suas respostas até o seu professor o corrigir.",
  },

  sync: {
    summary: (waiting: number, blocked: number, sending: boolean): string => {
      if (sending) return waiting === 1 ? "A enviar o seu trabalho..." : `A enviar ${waiting} trabalhos...`;
      if (waiting > 0) return waiting === 1 ? "1 trabalho à espera de ser enviado" : `${waiting} trabalhos à espera de serem enviados`;
      if (blocked > 0) return blocked === 1 ? "1 trabalho precisa da sua atenção" : `${blocked} trabalhos precisam da sua atenção`;
      return "Está tudo enviado";
    },
  },

  parentDash: {
    portal: "Portal do Encarregado de Educação",
    yourChild: "O seu educando",
    linkedNote: "Esta conta está ligada a um único aluno e mostra apenas a informação dele.",
    thisWeek: "Esta semana",
    lastWeek: "Semana passada",
    nothingMarkedThisWeek: "Ainda não foi corrigido nenhum trabalho desta semana.",
    tapAnyPiece: "Toque em qualquer trabalho para ver cada pergunta, a resposta do seu educando e a resposta correta.",
  },

  // --- O relatório semanal (shared/weekly-report.ts) ---
  report: {
    title: "Relatório semanal",
    child: "Aluno",
    classLabel: "Turma",
    week: "Semana",

    thisWeek: "Esta semana",
    daysActive: "Dias com trabalhos de casa feitos",
    homework: "Trabalhos de casa entregues",
    of: "de",
    average: "Média",
    nothingMarked: "ainda nada corrigido",
    streak: "Sequência atual",
    day: "dia",
    days: "dias",

    strongest: "Disciplina mais forte",
    needsAttention: "Precisa de atenção",

    messageForParents: "Mensagem para os encarregados de educação",
    closingAllDone:
      "Todos os trabalhos de casa marcados esta semana foram entregues. Obrigado por apoiar o seu educando em casa — nota-se.",
    closingSomeMissing: (n: number) =>
      n === 1
        ? "1 trabalho de casa marcado esta semana não foi entregue. Ajude o seu educando a pôr-se em dia para não ficar para trás."
        : `${n} trabalhos de casa marcados esta semana não foram entregues. Ajude o seu educando a pôr-se em dia para não ficar para trás.`,
    closingNoneDone:
      "Não foi entregue nenhum trabalho de casa esta semana. Fale com o seu educando e contacte-nos se houver alguma dificuldade — preferimos ajudar cedo.",
    closingNoHomeworkSet:
      "Não foi marcado nenhum trabalho de casa para o seu educando esta semana, por isso não há nada em falta.",

    signOff: "— On Point Education Centre",
  },

  // --- A visão geral do encarregado (shared/parent-overview.ts) ---
  overview: {
    average: "Média atual",
    averageNote: "De todo o trabalho corrigido até agora",
    nothingMarked: "Ainda não foi corrigido nenhum trabalho",
    subjects: "Notas por disciplina",
    subjectsEmpty: "Assim que houver trabalho corrigido, a média de cada disciplina aparece aqui.",
    recentMarks: "Notas recentes",
    recentMarksEmpty: "Ainda não há trabalho corrigido.",
    homework: "Trabalhos de casa",
    homeworkSet: "Marcados",
    homeworkDone: "Entregues",
    outstanding: "Ainda por entregar",
    outstandingEmpty: "Não há nada em falta — tudo o que foi marcado já foi entregue.",
    activity: "Dias com trabalhos de casa feitos",
    activityNote:
      "Dias, nas últimas quatro semanas, em que o seu educando entregou trabalho. Isto não é um registo de presenças na escola — o portal não mantém um registo de presenças.",
    feedback: "Comentários do professor",
    feedbackEmpty: "Ainda não há comentários escritos.",
    announcements: "Avisos da escola",
    announcementsEmpty: "Não há avisos de momento.",
    readOnly: "Esta conta é apenas de consulta. Pode ver o trabalho do seu educando, mas não o pode alterar.",
  },

  // --- O trabalho concluído (shared/parent-work.ts) ---
  work: {
    completedTitle: "Trabalho concluído",
    completedNote: "Tudo o que o seu educando entregou. Toque em qualquer trabalho para o ver pergunta a pergunta.",
    completedEmpty: "O seu educando ainda não entregou nada.",
    notMarkedYet: "Ainda não corrigido",
    handedIn: "Entregue",
    reviewNote: "É exatamente o mesmo que um professor lhe mostraria no dia de atendimento.",
    yourChildsAnswer: "Resposta do seu educando",
    correctAnswer: "Resposta correta",
    modelAnswer: "Como é uma boa resposta",
    modelAnswerNote:
      "Um exemplo do professor. A resposta do seu educando não tem de coincidir palavra por palavra — o que conta é a nota acima.",
    noAnswerGiven: "Não foi dada resposta",
    answeredWithPhoto: "Respondeu com uma fotografia do trabalho escrito",
    markedByTeacher: "Corrigido pelo professor",
    markedByTeacherNote:
      "Esta pergunta foi respondida por extenso e corrigida à mão, por isso não há uma única resposta certa com que a comparar.",
    teacherComment: "Comentário do professor",
    overallFeedback: "Comentário do professor sobre este trabalho",
    awaitingMarking: "O professor do seu educando ainda não corrigiu este trabalho.",
    outcomeCorrect: "Certo",
    outcomePartly: "Parcialmente certo",
    outcomeIncorrect: "Ainda não",
    outcomeNotMarked: "Ainda não corrigido",
    supportTitle: "Aspetos a praticar",
    supportNote:
      "Tudo o que está aqui é algo em que o seu educando pode melhorar com um pouco de prática. É um plano do que rever em conjunto, não uma lista de falhas.",
    supportEmpty:
      "Ainda não há nada a praticar. Assim que o trabalho do seu educando for corrigido, aparecerá aqui aquilo que valer a pena rever.",
    supportAllCorrect:
      "Não há nada a praticar de momento — o seu educando acertou em tudo no trabalho corrigido até agora. Os nossos parabéns.",
    practise: "Praticar",
    strongest: "Disciplina mais forte",
    workingOn: "A trabalhar em",
    basedOn: "Com base em",
    questionsMarked: "perguntas corrigidas",
    back: "Voltar",
    readOnly: "Esta conta é apenas de consulta. Pode ver o trabalho do seu educando, mas não o pode alterar.",
  },

  // --- Os jogos (shared/parent-plays.ts) ---
  plays: {
    title: "Jogos e tempo de ecrã",
    howItWorks:
      "Os jogos ganham-se, não se dão. Cada trabalho que o seu educando entrega dá-lhe uma jogada de cada jogo.",
    resetNote: "As jogadas recomeçam todas as manhãs. As jogadas não usadas não transitam.",
    earnedToday: "Jogadas ganhas hoje",
    usedToday: "Jogadas usadas hoje",
    leftToday: "Jogadas que restam hoje",
    bothGamesNote: "Cada trabalho dá uma jogada de cada jogo, por isso os dois jogos estão contados aqui.",
    week: "Os últimos sete dias",
    weekEarned: "Jogadas ganhas",
    weekUsed: "Jogadas usadas",
    weekActive: "Dias com trabalhos de casa entregues",
    nothingToday: "Não foi entregue nenhum trabalho hoje, por isso não foram ganhas jogadas hoje.",
    allUnused: "Ganhas hoje e ainda não usadas.",
    records: "Melhores pontuações",
    recordsEmpty: "Ainda não há jogos terminados.",
    notAvailable:
      "Os jogos são para os Stages 3 a 6. A turma do seu educando não os tem, por isso não há nada a ganhar nem a usar aqui.",
    notMinutes:
      "Isto conta jogadas ganhas e usadas, não minutos passados. O portal não regista quanto tempo o seu educando joga.",
    gameLine(label: string, left: number, earned: number): string {
      if (earned === 0) return `${label}: nada ganho hoje.`;
      if (left === 0) return `${label}: todas as ${earned} usadas.`;
      return `${label}: ${left} de ${earned} por usar.`;
    },
    recordLine(score: number, outOf: number): string {
      return outOf > 0 ? `${score} de ${outOf}` : "—";
    },
  },

  // --- Sem ligação (shared/offline.ts) ---
  offline: {
    saveForOffline: "Guardar para usar sem internet",
    saving: "A guardar...",
    savedForOffline: "Guardado neste dispositivo. Pode responder sem internet.",
    savedAlready: "Guardado neste dispositivo",
    cannotSave: "Não foi possível guardar isto no seu dispositivo. Tente novamente quando tiver internet.",

    handedInOffline: "Guardado no seu telemóvel",
    handedInOfflineDetail:
      "Não tem internet, por isso as suas respostas estão em segurança neste dispositivo. Serão enviadas ao seu professor sozinhas assim que voltar a ter ligação.",

    noPhotosOffline: "As fotografias precisam de internet. Pode escrever as suas respostas agora e juntar fotografias mais tarde.",
    cannotEditOffline: "Já entregou este trabalho, por isso só pode ser alterado com internet.",

    waitingHeading: "À espera de ser enviado",
    syncedJustNow: "Enviado ao seu professor",
    blockedHeading: "Precisa da sua atenção",
    offlineBadge: "Sem internet",

    markComesLater: "A sua nota aparece assim que o seu trabalho chegar à escola.",
  },
};
