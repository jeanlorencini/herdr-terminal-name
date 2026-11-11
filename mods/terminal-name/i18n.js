// Explicit selection: the installed Herdr API exposes no documented UI locale.
// English is the public default; set header content props.language to "pt-BR".
export function resolveLanguage(language) {
  return typeof language === "string" && language.trim().toLowerCase().split(/[-_]/)[0] === "pt" ? "pt-BR" : "en";
}

const translations = {
  en: {
    copyLabel: address => `Copy terminal reference ${address} for your AI agent`,
    tooltip: (address, name) => `Tell your AI agent: ${address}${name ? "\nName: " + name : ""}\nClick to copy the terminal reference`,
    copied: "Reference copied",
    copiedBody: address => `Use ${address} to point your AI agent to this terminal.`,
    needsYou: "Needs you",
    splitRight: "Split right",
    splitDown: "Split down",
    zoom: "Zoom pane",
    unzoom: "Restore panes",
    close: "Close pane",
    shell: "shell",
  },
  "pt-BR": {
    copyLabel: address => `Copiar referência do terminal ${address} para a IA`,
    tooltip: (address, name) => `Para indicar à IA: ${address}${name ? "\nNome: " + name : ""}\nClique para copiar a referência do terminal`,
    copied: "Referência copiada",
    copiedBody: address => `Use ${address} para indicar este terminal à IA.`,
    needsYou: "Precisa de você",
    splitRight: "Dividir à direita",
    splitDown: "Dividir abaixo",
    zoom: "Ampliar pane",
    unzoom: "Restaurar panes",
    close: "Fechar pane",
    shell: "shell",
  },
};

export function messages(language) {
  return translations[resolveLanguage(language)];
}
