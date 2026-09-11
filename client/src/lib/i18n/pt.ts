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

  dates: {
    months: [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ],
    long: (day: number, month: string, year: number) => `${day} de ${month} de ${year}`,
  },

  subjects: {
    MATHS: "Matemática",
    ENGLISH: "Inglês",
    SCIENCE: "Ciências",
    PHYSICS: "Física",
    CHEMISTRY: "Química",
    BIOLOGY: "Biologia",
    ECONOMICS: "Economia",
    BUSINESS_STUDIES: "Estudos Comerciais",
    GEOGRAPHY: "Geografia",
    COMPUTER_SCIENCE: "Informática",
    HISTORY: "História",
    ACCOUNTING: "Contabilidade",
  },

  library: {
    filterBySubject: "Filtrar por disciplina",
    allSubjects: "Todas as disciplinas",
    filterByType: "Filtrar por tipo",
    allTypes: "Todos os tipos",
    textbooks: "Manuais",
    videos: "Vídeos",
    lessonPlans: "Planos de aula",
    other: "Outros",
    video: "Vídeo",
    audio: "Áudio",
    noResources: "Não há recursos disponíveis",
    noResourcesNote: "O seu professor ainda não acrescentou recursos para a sua turma.",
    noLessons: "Não há aulas disponíveis",
  },

  register: {
    addStudent: "Adicionar aluno",
    editStudent: "Editar aluno",
    form: "Turma",
    studentId: "Número do aluno",
    studentIdPlaceholder: "ex.: F1-005",
    qrCode: "Código do cartão QR",
    qrCodePlaceholder: "ex.: G3-001",
    qrCodeNote: "O número do cartão de presença, da Base de Dados Principal de Alunos. Deixe em branco se o aluno ainda não tiver cartão.",
    fullName: "Nome completo",
    fullNamePlaceholder: "Escreva o nome completo",
    gender: "Sexo",
    male: "Masculino",
    female: "Feminino",
    active: "Ativo",
    filterByForm: "Filtrar por turma",
    allStudents: "Todos os alunos",
    noStudents: "Não foram encontrados alunos",
    passwordSet: "Palavra-passe definida",
    noPassword: "Sem palavra-passe",

    studentAdded: "Aluno adicionado",
    studentNotAdded: "O aluno não foi adicionado",
    studentUpdated: "Aluno atualizado",
    studentNotUpdated: "O aluno não foi atualizado",
    studentRemoved: "Aluno removido",
    passwordReset: "Palavra-passe reposta",
    passwordResetNote: "O aluno define uma nova palavra-passe da próxima vez que entrar.",
    passwordNotReset: "A palavra-passe não foi reposta",

    weeklyReport: "Relatório semanal",
    weekOf: (week: string) => `Semana de ${week}. Copie e envie ao encarregado de educação.`,
    copyAndSend: "Copie e envie ao encarregado de educação.",
    copyWhatsApp: "Copiar mensagem para WhatsApp",
    copied: "Copiado",
    copiedNote: "Relatório copiado. Cole-o no WhatsApp.",
    copyFailed: "Não foi possível copiar",
    copyFailedNote: "Selecione e copie o texto manualmente.",

    parentAccount: "Conta do encarregado de educação",
    addParentAccount: "Criar conta de encarregado de educação",
    parent: "Encarregado de educação",
    username: "Nome de utilizador",
    linkedTo: "Ligada a",
    parentName: "Nome do encarregado de educação",
    parentNamePlaceholder: "ex.: Sra. Rudo Moyo",
    usernamePlaceholder: "ex.: rmoyo",
    password: "Palavra-passe",
    passwordPlaceholder: "Pelo menos 6 caracteres",
    newPassword: "Nova palavra-passe",
    newPasswordPlaceholder: "Deixe em branco para manter a atual",
    parentCreated: "Conta criada",
    parentCreatedNote: "Entregue ao encarregado de educação o nome de utilizador e a palavra-passe. Entram em /parent/login.",
    parentNotCreated: "A conta não foi criada",
    parentRemoved: "Conta removida",
    parentRemovedNote: "O aluno e o trabalho dele ficam intactos.",
    parentUpdated: "Conta atualizada",
    parentUpdatedNote: "Os novos dados passam a valer na próxima vez que entrarem.",
    parentNotUpdated: "A conta não foi atualizada",

    pasteStudents: "Colar alunos",
    pasteNote: "Um aluno por linha. Entram todos na turma que escolher aqui. Quem já estiver na lista é ignorado.",
    pasteHint: "Acrescente \u201c| Feminino\u201d ou \u201c| Masculino\u201d depois do nome para indicar o sexo. Os números de aluno são atribuídos automaticamente.",
    pasteEmpty: "Não há ninguém novo para adicionar — todos estes nomes já estão na lista.",
    pasteClass: "Turma",
    pasteGender: "Sexo, se não for indicado",
    pasteNounOne: "aluno",
    pasteNounMany: "alunos",
    alreadyOnRegister: "Já está na lista",
    noName: "Sem nome",
    badGender: "O sexo deve ser \"Masculino\" ou \"Feminino\"",
  },

  teacherLibrary: {
    resources: "Recursos de Aprendizagem",
    resourcesNote: "Faça a gestão de manuais, vídeos e planos de aula",
    addResource: "Adicionar recurso",
    addResourceNote: "Acrescente um manual, um vídeo ou um plano de aula para os seus alunos",
    title: "Título",
    titlePlaceholder: "ex.: Manual de Matemática da 7.ª classe",
    type: "Tipo",
    selectType: "Escolha o tipo",
    subject: "Disciplina",
    selectSubject: "Escolha a disciplina",
    noSubject: "Sem disciplina",
    form: "Turma",
    allForms: "Todas as turmas",
    allFormsOption: "Todas as turmas",
    classLabel: "Turma",
    allClasses: "Todas as turmas",
    description: "Descrição (opcional)",
    descriptionPlaceholder: "Breve descrição...",
    youtubeUrl: "Ligação do YouTube",
    uploadFile: "Carregar ficheiro",
    uploadDocument: "Carregar documento",
    teacherOnly: "Só para professores",
    teacherOnlyNote: "Esconder este recurso dos alunos",
    noResources: "Não foram encontrados recursos",
    noResourcesNote: "Acrescente o seu primeiro recurso para começar",

    types: {
      TEXTBOOK: "Manual",
      YOUTUBE: "Vídeo do YouTube",
      LESSON_PLAN: "Plano de aula",
      OTHER: "Outro",
    },

    resourceAdded: "Recurso adicionado",
    resourceNotAdded: "O recurso não foi adicionado",
    resourceDeleted: "Recurso eliminado",
    resourceNotDeleted: "O recurso não foi eliminado",

    pasteResources: "Colar recursos",
    pasteNote: "Um recurso por linha, com a ligação depois de uma barra. Partilham todos o tipo, a disciplina e a turma que escolher aqui. As ligações já guardadas são ignoradas.",
    alreadySaved: "Esta ligação já está guardada",
    noTitle: "Sem título",
    noLink: "Sem ligação — ponha-a depois de um \"|\"",
  },

  teacherLessons: {
    title: "Aulas em Vídeo e Áudio",
    subtitle: "Carregue ou grave aulas para os seus alunos",
    addLesson: "Adicionar aula",
    addLessonNote: "Carregue um ficheiro de vídeo ou áudio, ou grave um aqui",
    lessonTitle: "Título",
    titlePlaceholder: "ex.: Introdução à Álgebra",
    description: "Descrição (opcional)",
    descriptionPlaceholder: "Breve descrição da aula...",
    type: "Tipo",
    selectType: "Escolha o tipo",
    selectSubject: "Escolha a disciplina",
    form: "Turma",
    selectForm: "Escolha a turma",
    lessonFile: "Ficheiro da aula",
    fileUploaded: "Ficheiro carregado com sucesso",
    duration: "Duração (opcional)",
    noLessons: "Ainda não há aulas",
    noLessonsNote: "Carregue ou grave a sua primeira aula em vídeo ou áudio",

    videoLesson: "Aula em vídeo",
    audioLesson: "Aula em áudio",

    lessonAdded: "Aula adicionada",
    lessonNotAdded: "A aula não foi adicionada",
    lessonDeleted: "Aula eliminada",
    recordingUploaded: "Gravação carregada",
    recordingNotUploaded: "A gravação não foi carregada",

    startRecording: "Começar a gravar",
    stopRecording: (time: string) => `Parar a gravação (${time})`,
    cameraPreview: "A pré-visualização da câmara aparece aqui",
    permissionDenied: (what: string) =>
      `Autorização recusada. Permita o acesso a ${what} nas definições do seu navegador.`,
    cameraAndMic: "câmara e microfone",
    microphone: "microfone",

    pasteLessons: "Colar aulas",
    pasteNote: "Uma aula por linha, com uma ligação do YouTube ou uma ligação para o ficheiro de vídeo ou áudio depois de uma barra. Partilham todas a disciplina e a turma que escolher aqui.",
    typeIfUnclear: "Tipo, se não for claro",
    alreadyALesson: "Este ficheiro já é uma aula",
    unplayableLink: "As ligações do Vimeo e do Dailymotion não podem ser reproduzidas aqui — carregue o ficheiro, use uma ligação do YouTube, ou ligue diretamente ao .mp4 ou .mp3",
  },

  gradeBook: {
    columns: {
      learner: "Aluno",
      class: "Turma",
      assignment: "Trabalho",
      handedIn: "Entregue",
      mark: "Nota",
      date: "Data",
    },
    title: "Pauta",
    subtitle: "Todas as notas de todos os trabalhos.",
    printTitle: "On Point Education Centre — Pauta",
    generated: (date: string) => `Gerada a ${date}`,
    learner: "Aluno",
    classLabel: "Turma",
    assignment: "Trabalho",
    handedIn: "Entregue",
    notHandedIn: "Não entregue",
    mark: "Nota",
    date: "Data",
    filters: "Filtros",
    allAssignments: "Todos os trabalhos",
    status: "Estado",
    allStatuses: "Todos os estados",
    handedNotMarked: "Entregues, ainda por corrigir",
    marked: "Corrigidos",
    handedInFrom: "Entregues desde",
    handedInTo: "Entregues até",
    perQuestion: "Detalhe pergunta a pergunta",
    noMarkedYet: "Ainda não há entregas corrigidas.",
    loading: "A carregar a pauta",
    nothingMatches: "Nada corresponde a esses filtros",
    noMarks: "Ainda não há notas",
    openSubmission: "Abrir esta entrega",
    backToDashboard: "Voltar ao painel",
  },

  reports: {
    filterByForm: "Filtrar por turma",
    allForms: "Todas as turmas",
    allFormsNote: "Todas as turmas",
    totalStudents: "Total de alunos",
    classAverage: "Média da turma",
    subjects: "Disciplinas",
    activeSubjects: "Disciplinas ativas",
    averagePercent: "Média %",
    averageScore: "Média",
    averageScoreLower: "Média",
    studentPerformance: "Desempenho por aluno",
    studentPerformanceNote: "Percentagem média por aluno",
    noStudentData: "Não há dados de alunos",
    subjectPerformance: "Desempenho por disciplina",
    subjectPerformanceNote: "Média por disciplina",
    noSubjectData: "Não há dados por disciplina",
    formComparison: "Comparação entre turmas",
    formComparisonNote: "Comparação do desempenho entre turmas",
    noFormData: "Não há dados por turma",
    studentDetails: "Detalhe por aluno",
    studentDetailsNote: "Desempenho individual, aluno a aluno",
    student: "Aluno",
    form: "Turma",
    handedIn: "Entregues",
    marked: "Corrigidos",
    score: "Nota",
    status: "Estado",
    noReportData: "Ainda não há dados para relatório.",

    bandTop: "80% ou mais",
    bandGood: "Bom",
    bandAverage: "Suficiente",
    bandNeedsHelp: "Precisa de ajuda",
  },



  dailyReport: {
    subtitle: "Crie um resumo de entregas pronto para o WhatsApp, para qualquer turma e data.",
    filters: "Filtros do relatório",
    date: "Data",
    today: "Hoje",
    yesterday: "Ontem",
    thisWeek: "Esta semana",
    customDate: "Outra data",
    classLabel: "Turma",
    selectClass: "Escolha uma turma",
    selectClassPlaceholder: "Escolha uma turma…",
    subject: "Disciplina",
    allSubjects: "Todas as disciplinas",
    copyWhatsApp: "Copiar mensagem para WhatsApp",
    copiedToClipboard: "Copiado",
    noneSubmitted: "Nada foi entregue neste período.",
    messageForParents: "Mensagem para os encarregados de educação",
    parentThanks: "Caros encarregados de educação, obrigado a todos os alunos que fizeram o trabalho de casa de hoje. O vosso esforço é notado e apreciado.",
    parentChase: "Os alunos que não entregaram devem completar o trabalho o mais depressa possível. O trabalho de casa faz parte da disciplina escolar e ajuda-nos a acompanhar o progresso. Pedimos aos encarregados de educação que apoiem os seus educandos todos os dias para que não fiquem para trás.",
    parentLowAttendance: "Quem tem entregado pouco trabalho de casa é gentilmente lembrado de melhorar e pôr-se em dia. Fazer os trabalhos com regularidade ajuda os alunos a ter melhores resultados e a não ficar para trás.",

    whatsHeading: "*Relatório de entregas de trabalhos de casa*",
    whatsDate: (date: string) => `Data: ${date}`,
    whatsClass: (form: string) => `Turma: ${form}`,
    whatsSubject: (subject: string) => `Disciplina: ${subject}`,
    whatsHandedIn: "*Entregaram:*",
    whatsNobody: "Ninguém entregou neste período.",
    whatsDidNot: "*Não entregaram:*",
    whatsEveryone: "Entregaram todos.",
    whatsNeedsToImprove: "*Precisam de entregar mais trabalhos de casa:*",
    whatsMessageForParents: "*Mensagem para os encarregados de educação:*",
    whatsSignOff: "— On Point Education Centre",
  },

  assignmentDetail: {
    updated: "Trabalho atualizado com sucesso",
    notUpdated: "Não foi possível atualizar o trabalho",
    archived: "Trabalho arquivado",
    restored: "Trabalho restaurado",
    archive: "Arquivar",
    unarchive: "Desarquivar",
    deadlineExtended: "Prazo alargado com sucesso",
    deadlineNotExtended: "Não foi possível alargar o prazo",
    theDueDate: "a data de entrega",
    messageCopied: "Mensagem copiada",
    extendDeadline: "Alargar o prazo de um aluno",
    extendDeadlineNote: "Dar mais tempo a um aluno em particular",
    student: "Aluno",
    selectStudent: "Escolha um aluno",
    newDueDate: "Novo prazo",
    reason: "Motivo (opcional)",
    reasonPlaceholder: "ex.: baixa médica, emergência familiar",
    currentExtensions: "Prazos alargados",
    instructions: "Instruções",
    questions: "Perguntas",
    allForms: "Todas as turmas",
    allFormsLower: "Todas as turmas",
    submitted: "Alunos que já entregaram o trabalho",
    noSubmissions: "Ainda não há entregas",
    needsReview: "Por corrigir",
    notSubmitted: "Alunos que ainda não entregaram",
    everyoneHandedIn: "Está tudo entregue.",
    notFound: "Trabalho não encontrado",
    notifyParent: (childName: string, title: string, subject: string, form: string, dueDate: string) =>
      `Caro encarregado de educação de ${childName},\n\nO seu educando ainda não entregou o trabalho "${title}" (Disciplina: ${subject}, Turma: ${form}), cujo prazo terminou a ${dueDate}.\n\nFale com ele e garanta que o trabalho é entregue o mais depressa possível.\n\nCom os melhores cumprimentos,\nOn Point Education Centre`,
  },

  exportData: {
    title: "Exportar dados",
    complete: "Exportação concluída",
    didNotFinish: "A exportação não terminou",
    sessionExpired: "A sua sessão expirou.",
    step1: "Passo 1 — Escolha o que exportar",
    step2: "Passo 2 — Defina os filtros",
    step3Note: "Contagem, ao vivo, do que vai ser incluído na exportação",
    fullMaster: "Exportação completa",
    fullMasterNote: "Todos os alunos, todos os trabalhos, todas as disciplinas.",
    byTerm: "Por trimestre",
    byTermNote: "Filtrar por trimestre (jan–mar = 1.º, abr–jun = 2.º, jul–set = 3.º, out–dez = 4.º)",
    byClassSubject: "Por turma e disciplina",
    byClassSubjectNote: "Filtrar por uma turma e/ou disciplina específica",
    byAssignment: "Por trabalho",
    byAssignmentNote: "O resultado de todos os alunos num trabalho — ideal para falar com os encarregados de educação",
    term: "Trimestre",
    selectTerm: "Escolha o trimestre...",
    classOptional: "Turma (opcional)",
    allClasses: "Todas as turmas",
    classLevel: "Turma",
    subject: "Disciplina",
    allSubjects: "Todas as disciplinas",
    assignment: "Trabalho",
    selectAssignment: "Escolha um trabalho...",
    archivedSuffix: "(arquivado)",
    calculating: "A calcular...",
    students: "Alunos",
    assignments: "Trabalhos",
    totalRows: "Total de linhas do CSV",
    onTime: "Dentro do prazo:",
    late: "Fora do prazo:",
    notSubmitted: "Não entregues:",
    selectFilters: "Escolha os filtros acima para ver uma pré-visualização.",
    noMatch: "Não há dados que correspondam aos filtros atuais.",
    generating: "A gerar o CSV...",
    download: "Descarregar CSV completo",
    history: "Histórico de exportações",
    historyNote: "As últimas 20 exportações desta conta",
    noExports: "Ainda não há exportações. Descarregue o seu primeiro CSV acima.",
    dateExported: "Data da exportação",
    filter: "Filtro",
    filterValue: "Valor do filtro",
    records: "Registos",
  },

  review: {
    types: {
      multiple_choice: "Escolha múltipla",
      true_false: "Verdadeiro / Falso",
      numeric: "Número",
      short_text: "Texto curto",
      written: "Resposta escrita (corrigida à mão)",
    },
    enterNumber: "Escreva um número",
    markUpdated: "Nota atualizada",
    couldNotUpdate: "Não foi possível atualizar",
    tryAgainPlease: "Tente novamente.",
    expired: "A sua sessão de professor expirou. Volte a entrar para ver esta entrega.",
    gone: "Esta entrega já não existe. Pode ter sido eliminada.",
    serverProblem: "O servidor teve um problema ao carregar esta entrega.",
    couldNotLoad: "Não foi possível carregar esta entrega. Verifique a sua ligação e tente novamente.",
    goToLogin: "Ir para o início de sessão",
    tryAgain: "Tentar novamente",
    backToGradeBook: "Voltar à pauta",
    allCorrect: "Todas as respostas certas",
    missed: (questions: string) => `Falhou ${questions}`,
    partialSuffix: " (parcial)",
    total: "total",
    awaitingMark: "por corrigir",
    teacherAdjusted: "Ajustado pelo professor",
    partial: "Parcial",
    studentsAnswer: "Resposta do aluno",
    noAnswerGiven: "Não foi dada resposta",
    noAnswerData: "Não há dados da resposta",
    modelAnswer: "Resposta modelo",
    correctAnswer: "Resposta correta:",
    override: "Corrigir:",
  },

  marking: {
    title: "Corrigir entrega",
    alreadyMarked: "Já corrigida",
    needsReview: "Por corrigir",
    marked: "Entrega corrigida",
    markedNote: "O aluno já consegue ver a nota.",
    notSaved: "A nota não foi guardada",
    aiAlert: "Alerta de deteção de IA",
    aiScore: "Indicação de IA:",
    aiScoreNote: (percent: number) => `${percent}% de probabilidade de ter sido gerado por IA`,
    quickMark: "Nota rápida:",
    full: "Tudo",
    half: "Metade",
    zero: "Zero",
    highlight: "Realçar:",
    studentsAnswer: "Resposta do aluno:",
    noTextAnswer: "Não foi dada resposta escrita",
    feedback: "Comentário (opcional)",
    feedbackPlaceholder: "Comentário sobre esta pergunta...",
    overallFeedback: "Comentário geral",
    generalComments: "Comentários gerais",
    generalCommentsPlaceholder: "Escreva um comentário geral para o aluno...",
    updateMark: "Atualizar nota",
    saveMark: "Guardar nota",
    notFound: "Entrega não encontrada",
  },

  createAssignment: {
    editTitle: "Editar trabalho",
    createTitle: "Criar novo trabalho",
    editNote: "Altere qualquer campo ou pergunta. O total de valores atualiza-se sozinho.",
    createNote: "Crie um trabalho com perguntas para os seus alunos. Pode juntar imagens às perguntas.",

    subject: "Disciplina",
    selectSubject: "Escolha a disciplina",
    form: "Turma",
    selectForm: "Escolha a turma",
    topic: "Tema (opcional)",
    topicPlaceholder: "ex.: Álgebra, Fotossíntese, Segunda Guerra Mundial",
    title: "Título",
    titlePlaceholder: "ex.: Trabalho de Matemática da semana 1",
    instructions: "Instruções",
    instructionsPlaceholder: "Escreva as instruções para os alunos...",
    dueDate: "Prazo de entrega",
    assignTo: "Atribuir a",
    questions: "Perguntas",

    moveUp: "Subir",
    moveDown: "Descer",
    remark: "Corrigir de novo",
    remarkNote: "Guardar as alterações e corrigir de novo esta pergunta para quem já entregou",
    duplicate: "Duplicar",
    duplicateNote: "Criar outra pergunta com as mesmas definições",
    saveToBank: "Guardar no banco",
    saveToBankNote: "Guardar uma cópia desta pergunta no Banco de Perguntas para reutilizar",
    addImage: "Juntar imagem",

    questionText: "Texto da pergunta",
    questionTextPlaceholder: "Escreva a sua pergunta...",
    answerType: "Tipo de resposta",
    maxScore: "Valor máximo",
    optional: "(opcional)",
    modelAnswerNote: "Como é uma boa resposta, pelas suas próprias palavras.",
    answerKey: "Resposta certa (usada para corrigir na hora)",
    optionsNote: "Acrescente as opções e toque no círculo para marcar a correta.",
    markAsCorrect: "Marcar como correta",
    correctAnswer: "Resposta correta:",
    trueLabel: "Verdadeiro",
    falseLabel: "Falso",
    correctNumber: "Número correto",
    tolerance: "Margem (±)",
    tolerancePlaceholder: "ex.: 0,05 (0 = exato)",
    acceptedNote: "Qualquer uma destas conta como correta. Maiúsculas e espaços a mais são ignorados.",
    explanation: "Explicação (opcional)",
    explanationPlaceholder: "Uma nota de uma linha, mostrada com a resposta correta",

    types: {
      multiple_choice: "Escolha múltipla",
      true_false: "Verdadeiro / Falso",
      numeric: "Número",
      short_text: "Texto curto",
      written: "Resposta escrita (corrigida à mão)",
    },

    pasteQuestions: "Colar perguntas",
    pasteNote: "Uma pergunta por linha, com a resposta depois de uma barra. Cada linha passa a ser uma pergunta de texto curto, com 1 valor, corrigida automaticamente.",
    pastedAdded: (n: number) => (n === 1 ? "1 pergunta acrescentada" : `${n} perguntas acrescentadas`),
    pastedAddedNote: "Cada uma é de texto curto, vale 1 valor, e já tem a resposta certa preenchida.",
    noQuestionText: "Sem texto da pergunta",
    noAnswer: "Sem resposta — ponha-a depois de um \"|\"",

    fromBank: (n: number) =>
      n === 1 ? "1 pergunta trazida do banco" : `${n} perguntas trazidas do banco`,
    fromBankNote: "São cópias — alterar a pergunta guardada mais tarde não muda este trabalho.",

    attachments: "Anexos (opcional)",
    attachmentsNote: "Carregue materiais de apoio para os alunos — imagens, PDF, documentos Word",
    uploadReference: "Carregar ficheiros de apoio",

    noStudentsSelected: "Não escolheu nenhum aluno",
    noStudentsSelectedNote: "Escolha pelo menos um aluno, ou escolha todos os alunos.",
    updated: "Trabalho atualizado",
    draftSaved: "Rascunho guardado",
    created: "Trabalho criado",
    updatedNote: "As suas alterações foram guardadas.",
    draftSavedNote: "Fica escondido dos alunos até tocar em Publicar.",
    createdNote: "O seu trabalho foi criado com sucesso.",
    notUpdated: "O trabalho não foi atualizado",
    notCreated: "O trabalho não foi criado",
    checkForm: "Verifique o formulário e tente novamente.",
    remarked: "Corrigido de novo",
    couldNotRemark: "Não foi possível corrigir de novo",
    tryAgainPlease: "Tente novamente.",

    saveDraft: "Guardar rascunho",
    saveChanges: "Guardar alterações",
    createButton: "Criar trabalho",

    alreadyHandedIn: (n: number) =>
      n === 1 ? "1 aluno já entregou." : `${n} alunos já entregaram.`,
    marksUnchangedNote: "Alterar as perguntas não muda as notas já dadas. Para alterar uma resposta certa, use o botão Corrigir de novo nessa pergunta.",
    questionNumber: (n: number) => `Pergunta ${n}`,
    questionImageAlt: (question: number, image: number) => `Imagem ${image} da pergunta ${question}`,
    optionPlaceholder: (n: number) => `Opção ${n}`,
    acceptedPlaceholder: (n: number) => `Resposta aceite ${n}`,
    pasteExample: "Qual é a capital do Zimbabué? | Harare\nQuantos lados tem um triângulo? | 3 | três\nQuem escreveu Nervous Conditions? | Tsitsi Dangarembga",
  },


  landing: {
    home: "Início",
    subjects: "Disciplinas",
    games: "Jogos",
    rewards: "Prémios",
    logIn: "Entrar",
    openMenu: "Abrir o menu",
    closeMenu: "Fechar o menu",
    yearGroups: "Turmas",
    backpack: "Mochila",
    screenshotAlt: "O ecrã de um trabalho num telemóvel: uma lista de perguntas de matemática, cada uma no seu cartão com os valores ao lado — valor posicional, sequências numéricas, as faces de um cubo, multiplicação e adição.",

    subjectTiles: {
      maths: "Matemática",
      english: "Inglês",
      science: "Ciências",
      business: "Gestão",
      computing: "Informática",
      more: "Mais disciplinas",
    },

    features: {
      homework: "Trabalhos de casa",
      homeworkNote: "Veja os seus trabalhos e entregue-os.",
      quizzes: "Questionários",
      quizzesNote: "Tenha a nota assim que terminar.",
      rewards: "Ganhar prémios",
      rewardsNote: "Ganhe XP e prémios pelos trabalhos que entrega.",
      games: "Jogos",
      gamesNote: "Pratique a jogar — marcação de penáltis, ilha do tesouro e mundo dos sonhos.",
    },
  },

  treasure: {
    title: "Ilha do Tesouro",
    chest: "O teu baú",
    log: "O teu registo de tesouros",
    next: "O teu próximo tesouro. Termina um trabalho para o abrires.",
    locked: "Fechado. Termina mais trabalhos para chegares a este.",
    unlockNext: "Termina outro trabalho para desbloqueares este tesouro.",
    mapAlt: "Mapa da ilha do tesouro, a mostrar que tesouros já juntaste",
  },

  controls: {
    close: "Fechar",
    cancel: "Cancelar",
    previous: "Anterior",
    next: "Seguinte",
  },

  dreamWorld: {
    nameYourTown: "Dá um nome à tua vila",
    save: "Guardar",
    rename: "Mudar o nome",
    nameIt: "Dar um nome",
    viewCertificate: "Ver e imprimir o teu certificado",
    homeworkFirst: "Primeiro os trabalhos de casa",
    buildShop: "Loja de construção",
    paused: "A construção está parada até os teus trabalhos de casa estarem feitos.",
    tapEmptyTile: "Agora toca num espaço vazio para construir. Toca num edifício para o tirar.",
    tapBuilding: "Toca num edifício desbloqueado e depois num espaço.",
    decoration: "Decoração",
    highestLevel: "Nível mais alto alcançado",
    newBuilding: "Novo edifício desbloqueado!",
    startBuilding: "Começar a construir",
    locked: "Fechado",
  },

  attachments: {
    hint: "Imagens, PDF, documentos Word, ficheiros de texto",
    attachFiles: "Anexar ficheiros",
    attachments: "Anexos",
    uploading: "A carregar...",
    dropFilesHere: "Largue aqui os ficheiros",
  },

  publish: {
    published: "Publicado",
    publishedNote: (title: string, form: string) => `"${title}" já está visível para a ${form}.`,
    notPublished: "O trabalho não foi publicado",
  },

  visiting: {
    backToMyTown: "Voltar à minha vila",
    backToTowns: "Voltar às vilas",
    visitTowns: "Visitar vilas",
    nobodyYet: "Ainda ninguém da tua turma começou uma vila. Constrói a tua e os teus colegas poderão visitá-la.",
    visitingNote: "Estás de visita. Não podes alterar esta vila.",
    youEarned: "Ganhaste",
    treasureFound: "Tesouro encontrado!",
    addedToCollection: "Juntou-se à tua coleção da Ilha do Tesouro.",
    scanYourCard: "Digitaliza o teu cartão",
    toggleTheme: "Mudar o tema",
    notFound: "404 — página não encontrada",
    comingSoon: "Em breve",
  },

  penalty: {
    title: "Marcação de Penáltis",
    nothingToPlay: "Ainda não há nada para jogar",
    orPickSubject: "Ou escolhe uma disciplina:",
    pickSubject: "Escolhe uma disciplina:",
    newBadge: "Novo",
    keeperRound: "Ronda de guarda-redes",
    strikerRound: "Ronda de marcador",
    saveWord: "Defesa",
    shotWord: "Remate",
    correct: "Certo!",
    pickYourCorner: "Agora escolhe o teu canto:",
    goalConceded: "Golo sofrido",
    savedByKeeper: "Defendido pelo guarda-redes",
    correctAnswerWas: "A resposta certa era",
    greatSave: "Grande defesa!",
    goodStrike: "Belo remate!",
    newBest: "Novo recorde pessoal!",
    beatOldRecord: (best: number, outOf: number, subject: string) =>
      `Bateste o teu recorde de ${best}/${outOf} em ${subject}.`,
    firstRecord: (subject: string) => `O teu primeiro recorde em ${subject}. Tenta bater-te na próxima.`,
    howYouDid: "Como te saíste",
    penaltiesScored: "Penáltis marcados",
    savesMade: "Defesas feitas",
    playAgain: "Jogar outra vez",
    pitchAlt: "Campo de futebol com uma baliza",
    goalAgainst: "Golo sofrido",
    corners: {
      left: "Esquerda",
      middle: "Meio",
      right: "Direita",
    },
  },

  bankScreen: {
    removed: "Removida do banco de perguntas",
    updated: "Pergunta atualizada",
    anySubject: "Qualquer disciplina",
    anyClass: "Qualquer turma",
    anyDifficulty: "Qualquer dificuldade",
    anyTopic: "Qualquer tema",
    confirmRemove: "Remover esta pergunta do banco?",
    keepIt: "Manter",
  },

  errors: {
    couldNotLoad: (what: string) => `Não foi possível carregar ${what}`,
    expired: "A sua sessão expirou. Volte a entrar para continuar.",
    noPermission: "Não tem permissão para fazer isso.",
    notFound: (what: string) => `Não foi possível encontrar ${what}. Pode já não existir.`,
    conflict: "Outra pessoa alterou isto primeiro. Recarregue a página e tente novamente.",
    serverProblem: "Algo correu mal do nosso lado. Tente novamente daqui a pouco.",
    connection: "Verifique a sua ligação e tente novamente.",
    logIn: "Entrar",
    tryAgain: "Tentar novamente",

    thing: {
      generic: "isto",
      yourResources: "os seus recursos",
      yourLessons: "as suas aulas",
      yourResults: "os seus resultados",
      yourResult: "o seu resultado",
      yourHomework: "os seus trabalhos de casa",
      yourAssignments: "os seus trabalhos",
      thisHomework: "este trabalho de casa",
      thisAssignment: "este trabalho",
      pendingSubmissions: "as entregas por corrigir",
      gradeBook: "a pauta",
      theRegister: "a lista de alunos",
      theReport: "o relatório",
      weeklyReport: "o relatório semanal",
      childDetails: "os dados do seu educando",
      childGamePlays: "as jogadas do seu educando",
      restOfChildInfo: "o resto da informação do seu educando",
    },
  },

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
    dashboard: "Painel",
  },

  results: {
    questionResults: "Resultados por pergunta",
    question: (n: number) => `Pergunta ${n}`,
    yourAnswer: "A sua resposta:",
    noAnswerProvided: "Não foi dada resposta",
    modelAnswer: "Como é uma boa resposta:",
    modelAnswerNote:
      "Um exemplo do seu professor. A sua não tem de coincidir palavra por palavra — compare as duas e veja o que poderia acrescentar da próxima vez.",
    feedback: "Comentário:",
    awaitingReview: "À espera de correção",
    beingReviewed: "A sua entrega está a ser corrigida pelo seu professor.",
    notFound: "Resultados não encontrados",
    questionImageAlt: (question: number, image: number) => `Imagem ${image} da pergunta ${question}`,
    attachmentAlt: (n: number) => `O seu anexo ${n}`,
  },

  parentWork: {
    mark: "Nota",
    questionsToGoOver: (n: number) => (n === 1 ? "1 pergunta a rever" : `${n} perguntas a rever`),
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

  // --- Acerta no Alvo (shared/blaster.ts) ---
  blaster: {
    title: "Acerta no Alvo",
    tagline: "Toca no alvo certo antes que ele fuja.",
    start: "Começar a acertar",
    round(n: number, total: number): string {
      return `Ronda ${n} de ${total}`;
    },
    hit: "Acertaste!",
    missed: "Falhaste",
    timedOut: "Demasiado devagar — fugiu!",
    nothingYet:
      "Termina primeiro um trabalho — o Acerta no Alvo é feito a partir de perguntas a que já respondeste.",
    scoreLine(score: number, outOf: number): string {
      return `Acertaste em ${score} de ${outOf}`;
    },
    newRecord: "Novo recorde!",
    bestSoFar: "O teu melhor",
    playAgain: "Jogar outra vez",
    backToDashboard: "Voltar ao painel",
  },

  // --- O banco de perguntas (shared/question-bank.ts) ---
  bank: {
    title: "Banco de Perguntas",
    subtitle: "As perguntas que guardou, prontas a usar outra vez.",
    difficulties: {
      easy: "Fácil",
      medium: "Médio",
      hard: "Difícil",
    },
    types: {
      multiple_choice: "Escolha múltipla",
      true_false: "Verdadeiro / Falso",
      numeric: "Número",
      short_text: "Texto curto",
    },
    answer: "Resposta",
    saved: "Guardada no banco de perguntas.",
    searchPlaceholder: "Procurar no texto de uma pergunta",
    empty: "Ainda não há perguntas guardadas que correspondam.",
    emptyLibrary:
      "Ainda não há nada guardado. Abra um trabalho, escreva uma pergunta e use \u201cGuardar no banco\u201d.",
    editWarning:
      "Isto altera apenas a cópia guardada. Os trabalhos que já usam esta pergunta não são afetados, e as notas já dadas mantêm-se.",
    deleteWarning:
      "Isto remove-a apenas da biblioteca. Os trabalhos que já usam esta pergunta ficam com ela, e as notas já dadas mantêm-se.",
    cannotSaveWritten:
      "Uma pergunta de resposta escrita é corrigida à mão, por isso não tem resposta para guardar. Só podem ir para o banco perguntas de escolha múltipla, verdadeiro/falso, número e texto curto.",
  },

  // --- As jogadas (shared/game-plays.ts) ---
  gamePlays: {
    title: "Jogadas que restam hoje",
    left(n: number): string {
      const jogadas = n === 1 ? "1 jogada" : `${n} jogadas`;
      return `${jogadas} — termina mais trabalhos para ganhares mais!`;
    },
    none: "Volta amanhã, ou termina outro trabalho para ganhares mais jogadas.",
    noneEarnedYet:
      "Entrega um trabalho hoje para ganhares uma jogada. Cada trabalho que terminas dá-te uma jogada de cada jogo.",
    spent(n: number): string {
      if (n <= 0) return "Essa foi a tua última jogada de hoje. Termina outro trabalho para ganhares mais.";
      return n === 1 ? "Resta-te 1 jogada hoje." : `Restam-te ${n} jogadas hoje.`;
    },
    earnedNote: "Ganhas 1 jogada de cada jogo por cada trabalho que entregas.",
    resetNote: "As jogadas recomeçam todas as manhãs. As jogadas não usadas não transitam.",
  },

  resume: {
    banner: "Deixaste este jogo a meio — continua de onde ficaste.",
    where(unit: string, n: number, total: number, score: number): string {
      return `De volta a ${unit} ${n} de ${total} — ${score} até agora.`;
    },
    noCost: "Sair de um jogo não gasta a tua jogada — podes voltar e terminá-lo.",
  },

  // --- Jogos e trabalhos de casa, para o professor (shared/teacher-plays.ts) ---
  teacherPlays: {
    title: "Jogos e trabalhos de casa",
    subtitle: "Quem está a ganhar as suas jogadas, e a quem o prémio não está a chegar.",
    howItWorks:
      "Cada trabalho que um aluno entrega dá-lhe uma jogada do Acerta no Alvo e uma da Marcação de Penáltis. As jogadas recomeçam todas as manhãs e não transitam.",
    pickClass: "Escolha uma turma",
    today: "Hoje",
    thisWeek: "Esta semana",
    children: "Alunos",
    earning: "Entregaram trabalho",
    playing: "Jogaram",
    neither: "Nem uma coisa nem outra",
    totalEarned: "Jogadas ganhas",
    totalUsed: "Jogadas usadas",
    groups: {
      earnedAndPlayed: "Ganharam e jogaram",
      earnedNotPlayed: "Ganharam, ainda não jogaram",
      playedNotEarned: "Jogaram, não ganharam nada",
      neither: "Nenhuma das duas",
    },
    groupNotes: {
      earnedAndPlayed: "Fizeram o trabalho e receberam o prémio.",
      earnedNotPlayed: "Fizeram o trabalho e ainda não jogaram. Nada a cobrar.",
      playedNotEarned: "Jogaram, mas não entregaram nada nestes dias.",
      neither: "Não entregaram trabalho nem jogaram.",
    },
    notAvailable:
      "Os jogos são para os Stages 3 a 6, por isso não há nada a mostrar para esta turma.",
    emptyClass: "Ainda não há alunos inscritos nesta turma.",
    notMinutes:
      "Isto conta jogadas ganhas e usadas, não minutos passados. O portal não regista quanto tempo um aluno joga.",
    usedLine(used: number, earned: number): string {
      return `${used} de ${earned} usadas`;
    },
  },

  // --- As competências da turma, para o professor (shared/mastery.ts) ---
  classMastery: {
    title: "Competências da turma",
    subtitle: "O que esta turma já mostrou saber fazer, a partir do trabalho já corrigido.",
    pickClass: "Escolha uma turma",
    children: "Alunos",
    withWork: "Com trabalho corrigido",
    topicsTracked: "Competências acompanhadas",
    reteach: "Vale a pena voltar a dar",
    reteachNote: "Do mais fraco para o mais forte. São os temas que a turma está a achar mais difíceis.",
    strongest: "A turma já tem estes",
    needSupport: "Alunos a acompanhar",
    needSupportNote:
      "Cada um destes tem pelo menos um tema abaixo de 50%. É o que o painel deles lhes está a mostrar.",
    splitWarning: "Turma dividida — uns já sabem, outros não. A média esconde isso.",
    spread(mastered: number, developing: number, practise: number): string {
      return `${mastered} já sabem · ${developing} quase lá · ${practise} a praticar`;
    },
    empty: "Ainda não há trabalho corrigido nesta turma, por isso não há competências a mostrar.",
    emptyClass: "Ainda não há alunos inscritos nesta turma.",
    noGaps: "Ninguém nesta turma tem um tema abaixo de 50%.",
    untaggedNote(n: number): string {
      return n === 1
        ? "1 pergunta corrigida não tinha tema, por isso não é mostrada como competência. Acrescente um tema a um trabalho para a incluir."
        : `${n} perguntas corrigidas não tinham tema, por isso não são mostradas como competências. Acrescente um tema a um trabalho para as incluir.`;
    },
  },

  // --- O mapa de competências (shared/mastery.ts) ---
  mastery: {
    title: "As minhas competências",
    subtitle: "O que já mostrou saber fazer, a partir do trabalho que entregou.",
    bands: {
      mastered: "Já sabe",
      developing: "Quase lá",
      practise: "Continue a praticar",
    },
    bandNotes: {
      mastered: "Acerta nestas quase sempre.",
      developing: "Está a caminho — mais um pouco de prática e chega lá.",
      practise: "Vale a pena rever. Toda a gente tem algumas destas.",
    },
    summary(mastered: number, total: number): string {
      if (total === 0) return "";
      if (mastered === 0) {
        return total === 1 ? "1 competência no seu mapa até agora." : `${total} competências no seu mapa até agora.`;
      }
      return total === 1
        ? `Já domina ${mastered} de 1 competência.`
        : `Já domina ${mastered} de ${total} competências.`;
    },
    empty: "Faça mais trabalhos de casa para construir o seu mapa de competências.",
    emptyNote:
      "Cada trabalho que entrega acrescenta alguma coisa. As suas competências aparecem aqui assim que forem corrigidas.",
    notEnoughYet:
      "Ainda não há trabalho corrigido que chegue para mostrar uma competência. Continue — enche-se depressa.",
    practiseHeading: "Aspetos a praticar",
    strongHeading: "Os seus pontos fortes",
    detail(scored: number, available: number, questions: number): string {
      const perguntas = questions === 1 ? "1 pergunta" : `${questions} perguntas`;
      return `${scored} de ${available} valores, em ${perguntas}`;
    },
  },

  // --- Os boletins (shared/report-card.ts) ---
  reportCard: {
    school: "On Point Education Centre",
    tagline: "Qualidade Sem Medida",
    heading: "Boletim",
    student: "Aluno",
    pupilId: "Número do aluno",
    form: "Turma",
    term: "Trimestre",
    issued: "Emitido",
    subject: "Disciplina",
    average: "Média",
    grade: "Nota",
    classAverage: "Média da turma",
    marked: "Trabalhos corrigidos",
    overall: "Média global",
    overallGrade: "Nota global",
    comment: "Comentário do professor",
    noComment: "Não foi acrescentado nenhum comentário.",
    attendance: "Dias com trabalhos de casa feitos",
    attendanceNote:
      "Dias em que este aluno entregou trabalho durante o trimestre. O portal não mantém um registo de presenças, por isso isto não é um registo de assiduidade.",
    boundariesHeading: "Escala de notas",
    nothingMarked:
      "Não foi corrigido nenhum trabalho deste aluno neste trimestre, por isso ainda não há nada a relatar.",
    print: "Imprimir boletim",
    printNote: "Escolha \u201cGuardar como PDF\u201d na caixa de impressão para ficar com uma cópia.",
    title: "Boletins",
    subtitle: "Reúna as notas de um trimestre num boletim para imprimir. Nada aqui altera uma nota.",
    pickClass: "Escolha uma turma",
    termLabel: "Nome do trimestre",
    termFrom: "De",
    termTo: "A",
    build: "Criar boletins",
    printAll: "Imprimir todos",
    editComment: "Comentário",
    saveComment: "Guardar comentário",
    commentSaved: "Comentário guardado.",
    commentPlaceholder: "Uma ou duas frases para a família ler.",
    editBoundaries: "Escala de notas",
    boundariesSaved: "Escala de notas guardada.",
    resetBoundaries: "Voltar à escala Cambridge",
  },

  // --- Maior progresso (shared/certificates.ts) ---
  mostImproved: {
    title: "Maior progresso",
    subtitle: "Compare dois períodos numa disciplina e premeie a maior subida.",
    pickClass: "Escolha uma turma",
    pickSubject: "Escolha uma disciplina",
    before: "Período anterior",
    after: "Período seguinte",
    run: "Comparar",
    award: "Atribuir certificado",
    awarded: "Certificado atribuído.",
    noCandidates:
      "Ninguém nesta turma tem trabalho corrigido nos dois períodos, por isso ainda não há progresso para medir.",
    cannotRank: "Sem trabalho corrigido num dos períodos",
    movement(before: number, after: number): string {
      const change = after - before;
      const sign = change > 0 ? "+" : "";
      return `${sign}${change} pontos, de ${before}% para ${after}%`;
    },
    certificateDetail(subject: string, before: number, after: number): string {
      return `${subject}: de ${before}% para ${after}%, uma subida de ${after - before} pontos`;
    },
  },

  // --- Os certificados (shared/certificates.ts) ---
  certificates: {
    school: "On Point Education Centre",
    tagline: "Qualidade Sem Medida",
    heading: "Certificado de Mérito",
    awardedTo: "Este certificado é atribuído com orgulho a",
    titles: {
      perfect_score: "Nota Máxima",
      streak_star: "Estrela da Constância",
      topic_master: "Domínio do Tema",
      level_up: "Subida de Nível",
      most_improved: "Maior Progresso",
    },
    reasons: {
      perfect_score: "por nota máxima, com todas as perguntas certas",
      streak_star: "por entregar trabalho todos os dias, sem falhar nenhum",
      topic_master: "por demonstrar verdadeiro domínio de um tema",
      level_up: "por esforço constante, nível após nível",
      most_improved: "pelo maior progresso de toda a turma",
    },
    areaTitle: "Os meus certificados",
    areaSubtitle: "Prémios que ganhou. Toque num para o abrir e imprimir.",
    empty: "Ainda não há certificados.",
    emptyNote:
      "Entregue os seus trabalhos, mantenha a sua sequência, e começarão a aparecer aqui.",
    print: "Imprimir certificado",
    printNote: "Escolha \u201cGuardar como PDF\u201d na caixa de impressão para ficar com uma cópia.",
    back: "Voltar",
    count(n: number): string {
      return n === 1 ? "1 certificado" : `${n} certificados`;
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
