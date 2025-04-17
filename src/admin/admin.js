// ================== CONFIG ==================
// Endereços dos contratos na blockchain
const ABUNDANCE_TOKEN_ADDRESS = "0x1f981d16990fbee674d04953b4dadd5460b45c41";
const ATK_MANAGER_ADDRESS = "0xbc0ed91cebd0b1cc89972f5d41f3de635d575c92";
const TCO2_TOKEN_ADDRESS = "0x65a1fec1bf8efc19ba9f3ada5c41fa20640f3488";
const TCO2_MANAGER_ADDRESS = "0x0c1fa197e8637151bb3e63d4c95b098b1129b6dc";

const DECIMALS = 18; // Quantidade de casas decimais dos tokens (padrão ERC20)

// ================== ABIs ==================
// Interfaces dos contratos utilizados com as funções necessárias
const AbundanceTokenABI = [
  "function totalSupply() view returns (uint256)"
];

const TCO2TokenABI = [
  "function totalSupply() view returns (uint256)"
];

const ATKManagerABI = [
  "function pendingRequests() view returns (uint256)",
  "function requestCounter() view returns (uint256)",
  "function requests(uint256) view returns (uint256,uint256,address,bool,bool,uint256)",
  "function createRequest(uint256,uint256) external",
  "function approveRequest(uint256)",
  "function rejectRequest(uint256, uint256)",
  "function addAuditor(address)",
  "function removeAuditor(address)"
];

const TCO2ManagerABI = [
  "function addCertifier(address)",
  "function removeCertifier(address)"
];

// Variáveis globais para provedor, contrato e endereço conectado
let provider, signer;
let abundanceToken, tco2Token, atkManager, tco2Manager;
let selectedRequestId = null;

// ================== Conexão ==================
// Conecta a carteira do usuário (MetaMask) e inicializa contratos
async function conectarCarteira() {
  if (!window.ethereum) return alert("MetaMask não encontrada.");

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  const address = await signer.getAddress();

  // Exibe endereço abreviado e copia com clique
  document.getElementById("shortAddress").innerText = `${address.slice(0, 6)}...${address.slice(-4)}`;
  document.getElementById("copyAddress").setAttribute("data-address", address);

  // Instancia contratos com as ABIs e o signer
  abundanceToken = new ethers.Contract(ABUNDANCE_TOKEN_ADDRESS, AbundanceTokenABI, signer);
  tco2Token = new ethers.Contract(TCO2_TOKEN_ADDRESS, TCO2TokenABI, signer);
  atkManager = new ethers.Contract(ATK_MANAGER_ADDRESS, ATKManagerABI, signer);
  tco2Manager = new ethers.Contract(TCO2_MANAGER_ADDRESS, TCO2ManagerABI, signer);

  // Carrega os dados iniciais da interface
  carregarDashboard();
  carregarRequests();
}

// Copia endereço da carteira ao clicar no botão
function copiarEndereco() {
  const fullAddress = document.getElementById("copyAddress").getAttribute("data-address");
  navigator.clipboard.writeText(fullAddress).then(() => alert("Endereço copiado!"));
}

// ================== Dashboard ==================
// Carrega informações principais: supply dos tokens e requests pendentes
async function carregarDashboard() {
  const totalATK = await abundanceToken.totalSupply();
  const totalTCO2 = await tco2Token.totalSupply();
  const pendentes = await atkManager.pendingRequests();

  // Formata unidades para leitura humana
  document.getElementById("totalSupply").innerText = ethers.utils.formatUnits(totalATK, DECIMALS);
  document.getElementById("totalTCO2").innerText = ethers.utils.formatUnits(totalTCO2, DECIMALS);
  document.getElementById("atksPendentes").innerText = pendentes.toString();
}

// ================== Requests ==================
// Carrega todas as requests criadas e separa em pendentes/concluídas
async function carregarRequests() {
  const total = await atkManager.requestCounter();
  const pendingList = document.getElementById("pendingRequests");
  const completedList = document.getElementById("completedRequests");
  pendingList.innerHTML = "";
  completedList.innerHTML = "";

  // Itera por todas as requests e as classifica
  for (let i = 1; i <= total; i++) {
    const req = await atkManager.requests(i);
    const li = document.createElement("li");
    li.innerText = `Request ${i}`;
    li.setAttribute("data-id", i);
    li.onclick = () => mostrarModal(i, req);

    if (req[4]) {
      completedList.appendChild(li);
    } else {
      pendingList.appendChild(li);
    }
  }
}

// Abre modal com detalhes da request selecionada
function mostrarModal(id, req) {
  selectedRequestId = id;

  const batchNumber = req[0];
  const amount = req[1];
  const requester = req[2];
  const approved = req[3];
  const processed = req[4];

  document.getElementById("modalId").innerText = id;
  document.getElementById("modalQtd").innerText = ethers.utils.formatUnits(amount, DECIMALS);
  document.getElementById("modalLote").innerText = batchNumber;
  document.getElementById("modalDest").innerText = requester;
  document.getElementById("modalStatus").innerText = approved
    ? "Aprovada"
    : processed
    ? "Rejeitada"
    : "Pendente";

  document.getElementById("modalRequest").classList.remove("hidden");
}

// Fecha o modal de request
function fecharModal() {
  document.getElementById("modalRequest").classList.add("hidden");
  selectedRequestId = null;
}

// ================== Aprovação e Rejeição ==================
// Chama a função do contrato para aprovar uma request
async function confirmarAprovacao() {
  try {
    const tx = await atkManager.approveRequest(selectedRequestId);
    await tx.wait();
    carregarRequests();
    fecharModal();
  } catch (err) {
    alert("Erro ao aprovar request");
    console.error(err);
  }
}

// Chama a função do contrato para rejeitar uma request com código
async function confirmarRejeicao() {
  const codigo = prompt("Informe o código de rejeição:");
  if (!codigo) return;
  try {
    const tx = await atkManager.rejectRequest(selectedRequestId, codigo);
    await tx.wait();
    carregarRequests();
    fecharModal();
  } catch (err) {
    alert("Erro ao rejeitar request");
    console.error(err);
  }
}

// ================== Criar Request ==================
// Função executada ao clicar no botão "Criar Request"
document.getElementById("createRequest").onclick = async () => {
  const quantidade = document.getElementById("quantidadeATK").value;
  const lote = document.getElementById("lote").value;

  if (!quantidade || !lote) return alert("Preencha todos os campos.");

  try {
    const formatted = ethers.utils.parseUnits(quantidade, DECIMALS);
    await atkManager.createRequest(lote, formatted);
    alert("Request criada com sucesso!");
    carregarRequests();
    carregarDashboard();
  } catch (err) {
    alert("Erro ao criar request");
    console.error(err);
  }
};

// ================== Auditor ==================
// Adiciona um novo auditor autorizado no contrato
async function adicionarAuditor() {
  const address = document.getElementById("auditorAddress").value;
  await atkManager.addAuditor(address);
  alert("Auditor adicionado!");
}

// Remove um auditor autorizado do contrato
async function removerAuditor() {
  const address = document.getElementById("auditorAddress").value;
  await atkManager.removeAuditor(address);
  alert("Auditor removido!");
}

// ================== Certificador ==================
// Adiciona um novo certificador autorizado no contrato
async function adicionarCertificador() {
  const address = document.getElementById("certifierAddress").value;
  await tco2Manager.addCertifier(address);
  alert("Certificador adicionado!");
}

// Remove um certificador autorizado do contrato
async function removerCertificador() {
  const address = document.getElementById("certifierAddress").value;
  await tco2Manager.removeCertifier(address);
  alert("Certificador removido!");
}

// ================== Inicializa ==================
// Executa automaticamente ao carregar a página
window.onload = () => conectarCarteira();
