// ===== Endereços e configurações =====
// Endereços dos contratos na blockchain
const ATK_ADDRESS = "0x1f981d16990fbee674d04953b4dadd5460b45c41";
const TCO2_ADDRESS = "0x65a1fec1bf8efc19ba9f3ada5c41fa20640f3488";
const TCO2_MANAGER_ADDRESS = "0x0c1fa197e8637151bb3e63d4c95b098b1129b6dc";
const DECIMALS = 18; // Padrão ERC20: 18 casas decimais

// ===== ABIs =====
// Interface mínima para interação com contratos ERC20 e o gerenciador de conversões
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",     // Retorna o saldo do usuário
  "function approve(address spender, uint256 amount) returns (bool)", // Aprova gasto
  "function allowance(address owner, address spender) view returns (uint256)" // Verifica quanto já foi aprovado
];

const TCO2_MANAGER_ABI = [
  "function requestConversion(uint256) external",            // Solicita conversão de ATK para TCO2
  "function requestCounter() view returns (uint256)",        // Total de requests feitas no contrato
  "function requests(uint256) view returns (uint256 requestId, address client, uint256 atkAmount, uint256 tco2Amount, bool approved, bool processed, uint256 rejectionCode)" // Detalhes da request
];

// ===== Variáveis globais =====
let provider, signer, userAddress;
let atkToken, tco2Token, tco2Manager;

// ===== Inicialização ao carregar a página =====
window.onload = async () => {
  await conectarCarteira();    // Conecta MetaMask e contratos
  await carregarSaldos();      // Mostra saldo de ATK e TCO2
  await carregarHistorico();   // Carrega histórico de conversões do usuário
};

// ===== Conectar carteira e contratos =====
async function conectarCarteira() {
  if (!window.ethereum) return alert("Instale o MetaMask.");

  // Configura provedor, solicita conta e recupera o signer
  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  // Instancia contratos de token ATK, TCO2 e o gerenciador
  atkToken = new ethers.Contract(ATK_ADDRESS, ERC20_ABI, signer);
  tco2Token = new ethers.Contract(TCO2_ADDRESS, ERC20_ABI, signer);
  tco2Manager = new ethers.Contract(TCO2_MANAGER_ADDRESS, TCO2_MANAGER_ABI, signer);

  // Exibe endereço abreviado no cabeçalho
  document.getElementById("shortAddress").innerText = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
  document.getElementById("copyAddress").setAttribute("data-address", userAddress);
}

// ===== Copiar endereço do usuário =====
function copiarEndereco() {
  const fullAddress = document.getElementById("copyAddress").getAttribute("data-address");
  navigator.clipboard.writeText(fullAddress).then(() => alert("Endereço copiado!"));
}

// ===== Carregar saldos de ATK e TCO2 do usuário =====
async function carregarSaldos() {
  const atkBalance = await atkToken.balanceOf(userAddress);
  const tco2Balance = await tco2Token.balanceOf(userAddress);

  // Formata e exibe os saldos
  document.getElementById("saldoATK").innerText = `${ethers.utils.formatUnits(atkBalance, DECIMALS)} ATK`;
  document.getElementById("saldoTCO2").innerText = `${ethers.utils.formatUnits(tco2Balance, DECIMALS)} TCO2`;
}

// ===== Solicitar conversão ATK → TCO2 =====
document.getElementById("solicitarConversao").onclick = async () => {
  const input = document.getElementById("quantidadeATK").value;
  if (!input || isNaN(input) || input <= 0) return alert("Insira uma quantidade válida de ATK.");

  const amount = ethers.utils.parseUnits(input, DECIMALS); // Converte para uint256

  try {
    // Verifica se já foi aprovado o valor necessário
    const allowance = await atkToken.allowance(userAddress, TCO2_MANAGER_ADDRESS);
    if (allowance.lt(amount)) {
      // Se não, aprova o valor necessário
      const approveTx = await atkToken.approve(TCO2_MANAGER_ADDRESS, amount);
      await approveTx.wait();
    }

    // Envia request de conversão
    const tx = await tco2Manager.requestConversion(amount);
    await tx.wait();

    alert("Solicitação enviada com sucesso!");
    carregarSaldos();      // Atualiza saldos
    carregarHistorico();   // Atualiza histórico
  } catch (err) {
    console.error(err);
    alert("Erro ao solicitar conversão.");
  }
};

// ===== Carregar histórico de conversões do usuário =====
async function carregarHistorico() {
  const total = await tco2Manager.requestCounter();
  const pendingUl = document.getElementById("pendingRequests");
  const completedUl = document.getElementById("completedRequests");

  pendingUl.innerHTML = "";
  completedUl.innerHTML = "";

  // Itera sobre todas as requests feitas no contrato
  for (let i = 1; i <= total; i++) {
    const req = await tco2Manager.requests(i);

    // Mostra apenas as requests feitas pelo usuário conectado
    if (req.client.toLowerCase() !== userAddress.toLowerCase()) continue;

    // Cria item de lista com detalhes da conversão
    const li = document.createElement("li");
    li.textContent = `Request #${req.requestId} - ${ethers.utils.formatUnits(req.atkAmount, DECIMALS)} ATK → ${ethers.utils.formatUnits(req.tco2Amount, DECIMALS)} TCO2`;

    // Se já processada, vai para "completas", senão para "pendentes"
    if (!req.processed) {
      pendingUl.appendChild(li);
    } else {
      completedUl.appendChild(li);
    }
  }
}
