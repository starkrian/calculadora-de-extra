// --- VALORES PADRÃO (Caso seja o primeiro acesso) ---
const PADROES = {
    meta: 1500.00,
    HE: { diurno: { bruto: 33.35, liquido: 24.18 }, noturno: { bruto: 50.03, liquido: 36.27 } },
    VD: { diurno: { bruto: 26.72, liquido: 26.72 }, noturno: { bruto: 32.29, liquido: 32.29 } }
};

// Carrega os valores customizados ou usa os padrões
let VALORES = JSON.parse(localStorage.getItem('configValores')) || PADROES;
let META = parseFloat(localStorage.getItem('configMeta')) || PADROES.meta;
let agenda = JSON.parse(localStorage.getItem('agendaServicos')) || [];

// --- TOAST NOTIFICATIONS ---
function showToast(mensagem, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast show ${tipo}`;
    setTimeout(() => { toast.classList.remove('show', tipo); }, 3000);
}

// --- CONTROLE DE ABAS ---
window.trocarAba = function(idAba, botaoClicado) {
    document.querySelectorAll('.tab-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    botaoClicado.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- TEMA ESCURO ---
const btnTema = document.getElementById('btnTema');
const metaThemeColor = document.getElementById('theme-color-meta');
function aplicarTema(tema) {
    if (tema === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        btnTema.textContent = '☀️ Tema Claro';
        metaThemeColor.setAttribute('content', '#0b1120');
    } else {
        document.documentElement.removeAttribute('data-theme');
        btnTema.textContent = '🌙 Tema Escuro';
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

// --- FERRAMENTAS E CÁLCULOS ---
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

// --- CALENDÁRIO MENSAL EM GRADE ---
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

// --- ATUALIZAR TELA (DASHBOARD) ---
function atualizarTela() {
    const mesSelecionado = document.getElementById('mesFiltro').value;
    renderizarCalendarioMensal(mesSelecionado);

    const lista = document.getElementById('listaServicos');
    lista.innerHTML = '';
    
    let brutoRealizado = 0, liquidoRealizado = 0, brutoPrevisto = 0, liquidoPrevisto = 0;
    let horasTotalHE = 0, horasTotalVD = 0;
    let ganhoSemanas = [0, 0, 0, 0]; // S1, S2, S3, S4

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

        // Distribui para o Gráfico
        if (dia <= 7) ganhoSemanas[0] += liq;
        else if (dia <= 14) ganhoSemanas[1] += liq;
        else if (dia <= 21) ganhoSemanas[2] += liq;
        else ganhoSemanas[3] += liq;

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

    // Atualiza Textos Financeiros
    document.getElementById('totalRealizado').textContent = formatarDinheiro(liquidoRealizado);
    document.getElementById('brutoRealizado').textContent = formatarDinheiro(brutoRealizado);
    document.getElementById('totalPrevisto').textContent = formatarDinheiro(liquidoPrevisto);
    document.getElementById('brutoPrevisto').textContent = formatarDinheiro(brutoPrevisto);

    const totalGeralLiquido = liquidoRealizado + liquidoPrevisto;
    document.getElementById('totalGeral').textContent = formatarDinheiro(totalGeralLiquido);
    document.getElementById('brutoGeral').textContent = formatarDinheiro(brutoRealizado + brutoPrevisto);
    document.getElementById('totalHorasHE').textContent = horasTotalHE.toFixed(1) + 'h';
    document.getElementById('totalHorasVD').textContent = horasTotalVD.toFixed(1) + 'h';

    // ATUALIZA A META
    document.getElementById('textoMetaV').textContent = META.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let pctMeta = (totalGeralLiquido / META) * 100;
    if (pctMeta > 100) pctMeta = 100;
    document.getElementById('barraMeta').style.width = pctMeta + '%';
    
    const falta = META - totalGeralLiquido;
    if (falta > 0) document.getElementById('textoFaltaMeta').textContent = `Faltam ${formatarDinheiro(falta)} para bater a meta.`;
    else document.getElementById('textoFaltaMeta').textContent = `🎉 Parabéns! Meta alcançada!`;

    // ATUALIZA GRÁFICO
    const maxSemana = Math.max(...ganhoSemanas, 1); // Evita divisão por zero
    for(let i=0; i<4; i++){
        let altura = (ganhoSemanas[i] / maxSemana) * 100;
        document.getElementById(`barS${i+1}`).style.height = altura + '%';
        document.getElementById(`barS${i+1}`).title = `Semana ${i+1}: ${formatarDinheiro(ganhoSemanas[i])}`;
    }
}
document.getElementById('mesFiltro').addEventListener('change', atualizarTela);

// --- SALVAR / EDITAR / EXCLUIR ---
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

    // Recalcula tudo retroativamente se os valores de Configurações mudaram
    const calculo = calcularServico(tipo, inicio, termino);
    const novoServico = { nomeServico, tipo, data, inicio, termino, calculo };
    
    if (editIndex > -1) {
        agenda[editIndex] = novoServico;
        document.getElementById('editIndex').value = "-1";
        document.getElementById('tituloFormulario').textContent = "Adicionar Serviço";
        document.getElementById('btnSalvar').textContent = "Salvar na Agenda";
        document.getElementById('btnCancelarEdicao').classList.add('hidden');
        showToast('✏️ Serviço atualizado!');
    } else { 
        agenda.push(novoServico); 
        showToast('✅ Serviço salvo com sucesso!');
    }

    localStorage.setItem('agendaServicos', JSON.stringify(agenda));
    document.getElementById('mesFiltro').value = data.substring(0, 7);
    atualizarTela();
    this.reset();
});

window.excluirItem = function(index) {
    if(confirm("Deseja excluir este serviço?")) {
        agenda.splice(index, 1);
        localStorage.setItem('agendaServicos', JSON.stringify(agenda));
        atualizarTela();
        showToast('🗑️ Serviço excluído', 'erro');
    }
}
document.getElementById('btnLimpar').addEventListener('click', function() {
    if(confirm("Tem certeza que deseja apagar TODO o histórico?")) {
        agenda = []; localStorage.removeItem('agendaServicos'); atualizarTela(); showToast('Tudo limpo!', 'erro');
    }
});

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

// --- CONFIGURAÇÕES ---
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

    localStorage.setItem('configMeta', META);
    localStorage.setItem('configValores', JSON.stringify(VALORES));
    
    // Recalcula o histórico antigo usando a nova tabela de valores
    agenda = agenda.map(item => {
        item.calculo = calcularServico(item.tipo, item.inicio, item.termino);
        return item;
    });
    localStorage.setItem('agendaServicos', JSON.stringify(agenda));
    
    showToast('⚙️ Configurações Salvas!');
    atualizarTela();
});

window.restaurarPadroes = function() {
    if(confirm("Voltar todos os valores da sua hora para os de fábrica?")) {
        VALORES = JSON.parse(JSON.stringify(PADROES)); // Clona padrão
        META = PADROES.meta;
        localStorage.setItem('configMeta', META);
        localStorage.setItem('configValores', JSON.stringify(VALORES));
        carregarConfiguracoesParaFormulario();
        
        // Recalcula o histórico com valores de fábrica
        agenda = agenda.map(item => { item.calculo = calcularServico(item.tipo, item.inicio, item.termino); return item; });
        localStorage.setItem('agendaServicos', JSON.stringify(agenda));
        
        atualizarTela();
        showToast('🔄 Padrões restaurados', 'erro');
    }
}

// INICIALIZAÇÃO
configurarMesInicial();
carregarConfiguracoesParaFormulario();
atualizarTela();

// PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}