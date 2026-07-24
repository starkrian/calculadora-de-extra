// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE (NUVEM)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDWJ2-ACUjQPIwi4jNrPFbHkyboWLA4RBE",
    authDomain: "calculadora-hevd.firebaseapp.com",
    projectId: "calculadora-hevd",
    storageBucket: "calculadora-hevd.firebasestorage.app",
    messagingSenderId: "489952953922",
    appId: "1:489952953922:web:8ed72a251fe875556d4fdb"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Ativando Persistência Offline
db.enablePersistence().catch(err => {
    if (err.code == 'failed-precondition') {
        console.log("Offline persistence falhou: Várias abas abertas.");
    } else if (err.code == 'unimplemented') {
        console.log("Navegador não suporta offline persistence.");
    }
});
const auth = firebase.auth();
let usuarioAtual = null;

// ==========================================
// 2. VARIÁVEIS DO APLICATIVO
// ==========================================
const PADROES = {
    meta: 1500.00,
    HE: { diurno: { bruto: 33.35, liquido: 24.18 }, noturno: { bruto: 50.03, liquido: 36.27 } },
    VD: { diurno: { bruto: 26.72, liquido: 26.72 }, noturno: { bruto: 32.29, liquido: 32.29 } }
};

let VALORES = JSON.parse(JSON.stringify(PADROES));
let META = PADROES.meta;
let agenda = [];

// ==========================================
// 3. SISTEMA DE LOGIN E SINCRONIZAÇÃO
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        // Usuário logado: Esconde tela de login e busca dados na nuvem
        usuarioAtual = user;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('userLogado').textContent = `Logado como: ${user.email}`;
        baixarDadosDaNuvem();
    } else {
        // Usuário deslogado: Mostra tela de login
        usuarioAtual = null;
        document.getElementById('loginOverlay').style.display = 'flex';
        agenda = []; 
    }
});

window.entrar = function() {
    const email = document.getElementById('emailLogin').value;
    const senha = document.getElementById('senhaLogin').value;
    document.getElementById('msgLogin').textContent = "Carregando...";
    auth.signInWithEmailAndPassword(email, senha)
        .catch(error => { document.getElementById('msgLogin').textContent = "Erro: Email ou senha incorretos."; });
}

window.criarConta = function() {
    const email = document.getElementById('emailLogin').value;
    const senha = document.getElementById('senhaLogin').value;
    if(senha.length < 6) return document.getElementById('msgLogin').textContent = "A senha deve ter pelo menos 6 letras/números.";
    document.getElementById('msgLogin').textContent = "Criando...";
    auth.createUserWithEmailAndPassword(email, senha)
        .catch(error => { document.getElementById('msgLogin').textContent = "Erro ao criar conta. Tente outro email."; });
}

window.sairConta = function() {
    auth.signOut();
    showToast("Você saiu da conta.");
}

// A Magia: Salva o pacote inteiro no banco de dados
function salvarNaNuvem() {
    if(usuarioAtual) {
        db.collection('usuarios').doc(usuarioAtual.uid).set({
            agenda: agenda,
            config: VALORES,
            meta: META
        }).catch(err => showToast("Erro ao salvar na nuvem", "erro"));
    }
}

// Busca os dados assim que o usuário entra
function baixarDadosDaNuvem() {
    if(usuarioAtual) {
        db.collection('usuarios').doc(usuarioAtual.uid).get().then(doc => {
            if (doc.exists) {
                const dados = doc.data();
                agenda = dados.agenda || [];
                VALORES = dados.config || JSON.parse(JSON.stringify(PADROES));
                META = dados.meta || PADROES.meta;
            } else {
                // Primeira vez usando: salva os padrões na nuvem
                agenda = []; VALORES = JSON.parse(JSON.stringify(PADROES)); META = PADROES.meta;
                salvarNaNuvem();
            }
            carregarConfiguracoesParaFormulario();
            atualizarTela();
            showToast('☁️ Dados Sincronizados!');
        });
    }
}

// ==========================================
// 4. FUNÇÕES GERAIS (TEMA, TOAST, ABAS)
// ==========================================
function showToast(mensagem, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem; toast.className = `toast show ${tipo}`;
    setTimeout(() => { toast.classList.remove('show', tipo); }, 3000);
}

window.trocarAba = function(idAba, botaoClicado) {
    document.querySelectorAll('.tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    botaoClicado.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const btnTema = document.getElementById('btnTema');
const metaThemeColor = document.getElementById('theme-color-meta');
function aplicarTema(tema) {
    if (tema === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        btnTema.textContent = '☀️ Voltar para Tema Claro';
        metaThemeColor.setAttribute('content', '#0b1120');
    } else {
        document.documentElement.removeAttribute('data-theme');
        btnTema.textContent = '🌙 Ativar Tema Escuro';
        metaThemeColor.setAttribute('content', '#1e40af');
    }
}
const temaSalvo = localStorage.getItem('tema');
if (temaSalvo) aplicarTema(temaSalvo);
btnTema.addEventListener('click', () => {
    const novoTema = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    aplicarTema(novoTema);
    localStorage.setItem('tema', novoTema);
});

// ==========================================
// 5. LÓGICA DO APLICATIVO E CÁLCULOS
// ==========================================
function formatarDinheiro(valor) { return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(dataString) { const p = dataString.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }

function configurarMesInicial() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('mesFiltro').value = `${ano}-${mes}`;
}

function calcularServico(tipo, inicio, termino) {
    let baseDate = "2000-01-01T";
    let horaInicio = new Date(baseDate + inicio + ":00");
    let horaTermino = new Date(baseDate + termino + ":00");
    if (horaTermino < horaInicio) horaTermino.setDate(horaTermino.getDate() + 1);

    let minDiurnos = 0, minNoturnos = 0;
    let atual = new Date(horaInicio);
    while (atual < horaTermino) {
        let h = atual.getHours();
        if (h >= 22 || h < 5) minNoturnos++; else minDiurnos++;
        atual.setMinutes(atual.getMinutes() + 1);
    }

    const hDiurnas = minDiurnos / 60; const hNoturnas = minNoturnos / 60;
    const tabela = VALORES[tipo];

    return { 
        horasDiurnas: hDiurnas, horasNoturnas: hNoturnas, 
        totalBruto: (hDiurnas * tabela.diurno.bruto) + (hNoturnas * tabela.noturno.bruto), 
        totalLiquido: (hDiurnas * tabela.diurno.liquido) + (hNoturnas * tabela.noturno.liquido) 
    };
}

// CALENDÁRIO MENSAL EM GRADE
function renderizarCalendarioMensal(mesSelecionado) {
    const grid = document.getElementById('gridCalendario');
    grid.innerHTML = '';
    if(!mesSelecionado) return;
    
    const [ano, mes] = mesSelecionado.split('-');
    const primeiroDia = new Date(ano, parseInt(mes) - 1, 1);
    const ultimoDia = new Date(ano, parseInt(mes), 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();

    const hoje = new Date();
    const stringHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

    for (let i = 0; i < diaSemanaInicio; i++) grid.innerHTML += `<div class="dia-calendario vazio"></div>`;

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const diaPadrao = String(dia).padStart(2, '0');
        const dataAtual = `${ano}-${mes}-${diaPadrao}`;
        const classeDomingo = new Date(ano, parseInt(mes) - 1, dia).getDay() === 0 ? 'dia-domingo' : '';
        const classeHoje = dataAtual === stringHoje ? 'dia-hoje' : '';

        const servicosDoDia = agenda.filter(item => item.data === dataAtual);
        let badgesHTML = '';
        servicosDoDia.forEach(ev => {
            const classeCor = ev.tipo === 'VD' ? 'bg-vd' : 'bg-he';
            const nomeCurto = ev.nomeServico || ev.tipo;
            badgesHTML += `<div class="evento-badge ${classeCor}" title="${ev.inicio} as ${ev.termino}">${nomeCurto}</div>`;
        });

        grid.innerHTML += `<div class="dia-calendario ${classeHoje} ${classeDomingo}"><div class="dia-numero">${dia}</div>${badgesHTML}</div>`;
    }
}

// ATUALIZAR TELA (DASHBOARD E LISTA)
function atualizarTela() {
    const mesSelecionado = document.getElementById('mesFiltro').value;
    renderizarCalendarioMensal(mesSelecionado);

    const lista = document.getElementById('listaServicos');
    lista.innerHTML = '';
    
    let brutoRealizado = 0, liquidoRealizado = 0, brutoPrevisto = 0, liquidoPrevisto = 0;
    let horasTotalHE = 0, horasTotalVD = 0;

    let hoje = new Date(); hoje.setHours(0,0,0,0);

    const agendaFiltrada = agenda.filter(item => item.data.startsWith(mesSelecionado));
    agendaFiltrada.sort((a, b) => new Date(a.data) - new Date(b.data));

    agendaFiltrada.forEach(item => {
        let dataItem = new Date(item.data + "T00:00:00");
        let liq = item.calculo.totalLiquido;

        if (dataItem <= hoje) { brutoRealizado += item.calculo.totalBruto; liquidoRealizado += liq; } 
        else { brutoPrevisto += item.calculo.totalBruto; liquidoPrevisto += liq; }

        const horasDoServico = item.calculo.horasDiurnas + item.calculo.horasNoturnas;
        if (item.tipo === 'HE') horasTotalHE += horasDoServico;
        else if (item.tipo === 'VD') horasTotalVD += horasDoServico;

        const indexReal = agenda.indexOf(item);
        const nomeExibicao = item.nomeServico || "Serviço sem nome";

        lista.innerHTML += `
            <div class="servico-item">
                <span class="data-badge">${formatarData(item.data)}</span>
                <strong>${nomeExibicao}</strong> - ${item.tipo} (${item.inicio} às ${item.termino})<br>
                <small class="texto-pequeno">Normais: ${item.calculo.horasDiurnas.toFixed(1)}h | Noturnas: ${item.calculo.horasNoturnas.toFixed(1)}h</small>
                <div class="valores">Líquido: ${formatarDinheiro(item.calculo.totalLiquido)} <br> <span class="texto-pequeno">(Bruto: ${formatarDinheiro(item.calculo.totalBruto)})</span></div>
                <div class="acoes-item">
                    <button class="btn-editar" onclick="editarItem(${indexReal})">✏️ Editar</button>
                    <button class="btn-excluir" onclick="excluirItem(${indexReal})">🗑️ Excluir</button>
                </div>
            </div>
        `;
    });

    if (agendaFiltrada.length === 0) lista.innerHTML = '<p style="text-align:center;" class="texto-pequeno">Nenhum serviço adicionado.</p>';

    document.getElementById('totalRealizado').textContent = formatarDinheiro(liquidoRealizado);
    document.getElementById('brutoRealizado').textContent = formatarDinheiro(brutoRealizado);
    document.getElementById('totalPrevisto').textContent = formatarDinheiro(liquidoPrevisto);
    document.getElementById('brutoPrevisto').textContent = formatarDinheiro(brutoPrevisto);

    const totalGeralLiquido = liquidoRealizado + liquidoPrevisto;
    document.getElementById('totalGeral').textContent = formatarDinheiro(totalGeralLiquido);
    document.getElementById('brutoGeral').textContent = formatarDinheiro(brutoRealizado + brutoPrevisto);
    document.getElementById('totalHorasHE').textContent = horasTotalHE.toFixed(1) + 'h';
    document.getElementById('totalHorasVD').textContent = horasTotalVD.toFixed(1) + 'h';

    // META
    document.getElementById('textoMetaV').textContent = META.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let pctMeta = (totalGeralLiquido / META) * 100;
    if (pctMeta > 100) pctMeta = 100;
    document.getElementById('barraMeta').style.width = pctMeta + '%';
    const falta = META - totalGeralLiquido;
    if (falta > 0) document.getElementById('textoFaltaMeta').textContent = `Faltam ${formatarDinheiro(falta)} para bater a meta.`;
    else document.getElementById('textoFaltaMeta').textContent = `🎉 Parabéns! Meta alcançada!`;
}
document.getElementById('mesFiltro').addEventListener('change', atualizarTela);

// AÇÕES DE FORMULÁRIO (AGORA SALVANDO NA NUVEM)
window.editarItem = function(index) {
    const item = agenda[index];
    document.getElementById('nomeServico').value = item.nomeServico || '';
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('data').value = item.data;
    document.getElementById('inicio').value = item.inicio;
    document.getElementById('termino').value = item.termino;
    document.getElementById('editIndex').value = index;
    
    document.getElementById('tituloFormulario').textContent = "Editar Serviço";
    document.getElementById('btnSalvar').textContent = "Atualizar Serviço";
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    trocarAba('abaInicio', document.querySelectorAll('.nav-btn')[0]);
    document.getElementById('areaFormulario').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('btnCancelarEdicao').addEventListener('click', () => {
    document.getElementById('serviceForm').reset();
    document.getElementById('editIndex').value = "-1";
    document.getElementById('tituloFormulario').textContent = "Adicionar Serviço";
    document.getElementById('btnSalvar').textContent = "Salvar na Agenda";
    document.getElementById('btnCancelarEdicao').classList.add('hidden');
});

document.getElementById('serviceForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const nomeServico = document.getElementById('nomeServico').value;
    const tipo = document.getElementById('tipo').value;
    const data = document.getElementById('data').value;
    const inicio = document.getElementById('inicio').value;
    const termino = document.getElementById('termino').value;
    const editIndex = parseInt(document.getElementById('editIndex').value);

    const calculo = calcularServico(tipo, inicio, termino);
    const novoServico = { nomeServico, tipo, data, inicio, termino, calculo };
    
    if (editIndex > -1) {
        agenda[editIndex] = novoServico;
        document.getElementById('editIndex').value = "-1";
        document.getElementById('tituloFormulario').textContent = "Adicionar Serviço";
        document.getElementById('btnSalvar').textContent = "Salvar na Agenda";
        document.getElementById('btnCancelarEdicao').classList.add('hidden');
        showToast('✏️ Atualizado na Nuvem!');
    } else { 
        agenda.push(novoServico); 
        showToast('☁️ Salvo na Nuvem!');
    }

    salvarNaNuvem(); // SUBIU PRA NUVEM!
    document.getElementById('mesFiltro').value = data.substring(0, 7);
    atualizarTela();
    this.reset();
});

window.excluirItem = function(index) {
    if(confirm("Deseja excluir este serviço?")) {
        agenda.splice(index, 1);
        salvarNaNuvem(); // APAGOU DA NUVEM!
        atualizarTela();
        showToast('🗑️ Serviço excluído', 'erro');
    }
}
document.getElementById('btnLimpar').addEventListener('click', function() {
    if(confirm("Tem certeza que deseja apagar TODO o histórico?")) {
        agenda = []; salvarNaNuvem(); atualizarTela(); showToast('Tudo limpo!', 'erro');
    }
});

// ==========================================
// 6. EXPORTAR E IMPORTAR PLANILHAS
// ==========================================
document.getElementById('btnExportar').addEventListener('click', function() {
    if (agenda.length === 0) return showToast("A agenda está vazia", 'erro');
    const agendaExportar = [...agenda].sort((a, b) => new Date(a.data) - new Date(b.data));
    const cabecalho = ["Nome", "Tipo", "Data", "Inicio", "Termino", "H. Diurnas", "H. Noturnas", "V. Bruto", "V. Liquido"];
    let csvRows = [cabecalho.join(";")];
    agendaExportar.forEach(item => {
        const linha = [
            item.nomeServico || "Sem nome", item.tipo, formatarData(item.data), item.inicio, item.termino,
            item.calculo.horasDiurnas.toFixed(2).replace('.', ','), item.calculo.horasNoturnas.toFixed(2).replace('.', ','),
            item.calculo.totalBruto.toFixed(2).replace('.', ','), item.calculo.totalLiquido.toFixed(2).replace('.', ',')
        ];
        csvRows.push(linha.join(";"));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Relatorio_HE_VD.csv"; link.click();
    showToast('📥 Excel exportado!');
});

document.getElementById('fileImport').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        const linhas = text.split('\n');
        let importados = 0;
        
        for(let i = 1; i < linhas.length; i++) { 
            if(!linhas[i].trim()) continue;
            const colunas = linhas[i].split(';');
            if(colunas.length >= 5) {
                const nome = colunas[0]; const tipo = colunas[1];
                const dataBr = colunas[2]; const inicio = colunas[3]; const termino = colunas[4].trim();
                const partesData = dataBr.split('/');
                if(partesData.length === 3) {
                    const dataUs = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;
                    const calculo = calcularServico(tipo, inicio, termino);
                    agenda.push({
                        nomeServico: nome === "Sem nome" ? "" : nome,
                        tipo: tipo, data: dataUs, inicio: inicio, termino: termino, calculo: calculo
                    });
                    importados++;
                }
            }
        }
        if(importados > 0) {
            salvarNaNuvem(); // SALVA A IMPORTAÇÃO NA NUVEM!
            atualizarTela();
            showToast(`✅ ${importados} serviços recuperados e salvos na nuvem!`);
        } else {
            showToast(`⚠️ Nenhum dado válido encontrado.`, 'erro');
        }
    };
    reader.readAsText(file);
    this.value = ''; 
});

// ==========================================
// 7. CONFIGURAÇÕES
// ==========================================
function carregarConfiguracoesParaFormulario() {
    document.getElementById('cfgMeta').value = META;
    document.getElementById('cfgHeD_B').value = VALORES.HE.diurno.bruto;
    document.getElementById('cfgHeD_L').value = VALORES.HE.diurno.liquido;
    document.getElementById('cfgHeN_B').value = VALORES.HE.noturno.bruto;
    document.getElementById('cfgHeN_L').value = VALORES.HE.noturno.liquido;
    
    document.getElementById('cfgVdD_B').value = VALORES.VD.diurno.bruto;
    document.getElementById('cfgVdD_L').value = VALORES.VD.diurno.liquido;
    document.getElementById('cfgVdN_B').value = VALORES.VD.noturno.bruto;
    document.getElementById('cfgVdN_L').value = VALORES.VD.noturno.liquido;
}

document.getElementById('configForm').addEventListener('submit', function(e) {
    e.preventDefault();
    META = parseFloat(document.getElementById('cfgMeta').value);
    
    VALORES.HE.diurno.bruto = parseFloat(document.getElementById('cfgHeD_B').value);
    VALORES.HE.diurno.liquido = parseFloat(document.getElementById('cfgHeD_L').value);
    VALORES.HE.noturno.bruto = parseFloat(document.getElementById('cfgHeN_B').value);
    VALORES.HE.noturno.liquido = parseFloat(document.getElementById('cfgHeN_L').value);

    VALORES.VD.diurno.bruto = parseFloat(document.getElementById('cfgVdD_B').value);
    VALORES.VD.diurno.liquido = parseFloat(document.getElementById('cfgVdD_L').value);
    VALORES.VD.noturno.bruto = parseFloat(document.getElementById('cfgVdN_B').value);
    VALORES.VD.noturno.liquido = parseFloat(document.getElementById('cfgVdN_L').value);

    agenda = agenda.map(item => { item.calculo = calcularServico(item.tipo, item.inicio, item.termino); return item; });
    
    salvarNaNuvem(); // SALVA A NOVA TABELA E O RECALCULO NA NUVEM!
    showToast('⚙️ Configurações Salvas na Nuvem!');
    atualizarTela();
});

window.restaurarPadroes = function() {
    if(confirm("Voltar todos os valores da sua hora para os de fábrica?")) {
        VALORES = JSON.parse(JSON.stringify(PADROES)); 
        META = PADROES.meta;
        carregarConfiguracoesParaFormulario();
        
        agenda = agenda.map(item => { item.calculo = calcularServico(item.tipo, item.inicio, item.termino); return item; });
        
        salvarNaNuvem();
        atualizarTela();
        showToast('🔄 Padrões restaurados', 'erro');
    }
}

// INICIALIZAÇÃO VISUAL (Enquanto aguarda o Firebase logar)
configurarMesInicial();