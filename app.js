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

// Ativando Persistência Offline (Funciona mesmo sem internet!)
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
        usuarioAtual = user;
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('userLogado').textContent = `Logado como: ${user.email}`;
        baixarDadosDaNuvem();
    } else {
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

function salvarNaNuvem() {
    if(usuarioAtual) {
        db.collection('usuarios').doc(usuarioAtual.uid).set({
            agenda: agenda,
            config: VALORES,
            meta: META
        }).catch(err => showToast("Erro ao salvar na nuvem", "erro"));
    }
}

function baixarDadosDaNuvem() {
    if(usuarioAtual) {
        db.collection('usuarios').doc(usuarioAtual.uid).get().then(doc => {
            if (doc.exists) {
                const dados = doc.data();
                agenda = dados.agenda || [];
                VALORES = dados.config || JSON.parse(JSON.stringify(PADROES));
                META = dados.meta || PADROES.meta;
            } else {
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
// 4. FUNÇÕES GERAIS
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
// 5. CÁLCULOS
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

function atualizarTela() {
    const mesSelecionado = document.getElementById('mesFiltro').value;
    renderizarCalendarioMensal(mesSelecionado);
    const lista = document.getElementById('listaServicos');
    lista.innerHTML = '';
    let brutoRealizado = 0, liquidoRealizado = 0, brutoPrevisto = 0, liquidoPrevisto = 0;
    let horasTotalHE = 0, horasTotalVD = 0;
    let ganhoSemanas = [0, 0, 0, 0];
    let hoje = new Date(); hoje.setHours(0,0,0,0);
    const agendaFiltrada = agenda.filter(item => item.data.startsWith(mesSelecionado));
    agendaFiltrada.sort((a, b) => new Date(a.data) - new Date(b.data));
    agendaFiltrada.forEach(item => {
        let dataItem = new Date(item.data + "T00:00:00");
        let dia = dataItem.getDate();
        let liq = item.calculo.totalLiquido;
        if (dataItem <= hoje) { brutoRealizado += item.calculo.totalBruto; liquidoRealizado += liq; } 
        else { brutoPrevisto += item.calculo.totalBruto; liquidoPrevisto += liq; }
        const horasDoServico = item.calculo.horasDiurnas + item.calculo.horasNoturnas;
        if (item.tipo === 'HE') horasTotalHE += horasDoServico;
        else if (item.tipo === 'VD') horasTotalVD += horasDoServico;
        if (dia <= 7) ganhoSemanas[0] += liq;
        else if (dia <= 14) ganhoSemanas[1] += liq;
        else if (dia <= 21) ganhoSemanas[2] += liq;
        else ganhoSemanas[3] += liq;
        const indexReal = agenda.indexOf(item);
        lista.innerHTML += `
            <div class="servico-item">
                <span class="data-badge">${formatarData(item.data)}</span>
                <strong>${item.nomeServico || "Sem nome"}</strong> - ${item.tipo} (${item.inicio} às ${item.termino})<br>
                <div class="valores">Líquido: ${formatarDinheiro(item.calculo.totalLiquido)}</div>
                <div class="acoes-item">
                    <button class="btn-editar" onclick="editarItem(${indexReal})">✏️ Editar</button>
                    <button class="btn-excluir" onclick="excluirItem(${indexReal})">🗑️ Excluir</button>
                </div>
            </div>`;
    });
    document.getElementById('totalRealizado').textContent = formatarDinheiro(liquidoRealizado);
    document.getElementById('totalPrevisto').textContent = formatarDinheiro(liquidoPrevisto);
    document.getElementById('totalGeral').textContent = formatarDinheiro(liquidoRealizado + liquidoPrevisto);
    document.getElementById('totalHorasHE').textContent = horasTotalHE.toFixed(1) + 'h';
    document.getElementById('totalHorasVD').textContent = horasTotalVD.toFixed(1) + 'h';
    document.getElementById('textoMetaV').textContent = META.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let pctMeta = ((liquidoRealizado + liquidoPrevisto) / META) * 100;
    document.getElementById('barraMeta').style.width = (pctMeta > 100 ? 100 : pctMeta) + '%';
    const falta = META - (liquidoRealizado + liquidoPrevisto);
    document.getElementById('textoFaltaMeta').textContent = falta > 0 ? `Faltam ${formatarDinheiro(falta)}` : `🎉 Meta alcançada!`;
}
document.getElementById('mesFiltro').addEventListener('change', atualizarTela);

window.editarItem = function(index) {
    const item = agenda[index];
    document.getElementById('nomeServico').value = item.nomeServico;
    document.getElementById('tipo').value = item.tipo;
    document.getElementById('data').value = item.data;
    document.getElementById('inicio').value = item.inicio;
    document.getElementById('termino').value = item.termino;
    document.getElementById('editIndex').value = index;
    document.getElementById('btnSalvar').textContent = "Atualizar Serviço";
    document.getElementById('btnCancelarEdicao').classList.remove('hidden');
    trocarAba('abaInicio', document.querySelectorAll('.nav-btn')[0]);
}

document.getElementById('serviceForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const novoServico = { 
        nomeServico: document.getElementById('nomeServico').value,
        tipo: document.getElementById('tipo').value,
        data: document.getElementById('data').value,
        inicio: document.getElementById('inicio').value,
        termino: document.getElementById('termino').value,
        calculo: calcularServico(document.getElementById('tipo').value, document.getElementById('inicio').value, document.getElementById('termino').value)
    };
    const editIndex = parseInt(document.getElementById('editIndex').value);
    if (editIndex > -1) agenda[editIndex] = novoServico; else agenda.push(novoServico);
    salvarNaNuvem();
    atualizarTela();
    this.reset();
    document.getElementById('btnCancelarEdicao').classList.add('hidden');
});

window.excluirItem = function(index) {
    agenda.splice(index, 1);
    salvarNaNuvem();
    atualizarTela();
}

window.restaurarPadroes = function() {
    VALORES = JSON.parse(JSON.stringify(PADROES));
    META = PADROES.meta;
    salvarNaNuvem();
    atualizarTela();
}

configurarMesInicial();