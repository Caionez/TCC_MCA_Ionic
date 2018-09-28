import { Component } from "@angular/core";
import { RegistroAgua, DadosResumidosAgua } from "../../model/registro-agua";
import {
  LoadingController,
  ModalController,
  Platform,
  ViewController
} from "ionic-angular";

import { File } from "@ionic-native/file";

@Component({
  selector: "visualizar-dados",
  templateUrl: "visualizar-dados.html"
})
export class VisualizarDadosPage {
  readonly padraoData: {
    year: "numeric";
    month: "numeric";
    day: "numeric";
    hour: "2-digit";
    minute: "2-digit";
  };
  plataformaCordova: boolean;
  dadosLidos: boolean;
  filtro: any;
  dados: Array<RegistroAgua>;
  menorDataEncontrada: string;
  maiorDataEncontrada: string;
  dadosFiltrados: Array<RegistroAgua>;
  dadosPorHora: Array<DadosResumidosAgua>;
  dadosPorDia: Array<DadosResumidosAgua>;
  exibirGraficoHora: boolean;
  exibirGraficoDia: boolean;

  parametros: {
    fluxoTotal: number;
    maiorFluxo: RegistroAgua;
    menorFluxo: RegistroAgua;
  };

  file = new File();

  constructor(
    public loadingCtrl: LoadingController,
    public modalCtrl: ModalController,
    public plt: Platform
  ) {
    this.filtro = {
      DataInicial: "",
      DataFinal: ""
    };

    this.plataformaCordova = plt.is("cordova");
    this.lineChartData = new Array<any>();
    this.lineChartLabels = new Array<any>();
  }

  filtrarDados() {
    console.log(this.filtro);

    let loading = this.loadingCtrl.create({
      content: "Lendo Arquivo..."
    });

    loading.present();

    this.processarArquivo();

    //loading.setContent('Filtrando os Dados...');
    loading.dismiss();
  }

  processarArquivo() {
    let linhasArquivo: String[];

    if (this.plataformaCordova) {
      this.file
        .readAsText(this.file.externalRootDirectory, "dados.csv")
        .then(streamArquivo => {
          linhasArquivo = streamArquivo.split("\n");
          this.montarObjetosDados(linhasArquivo);
        });
    } else {
      linhasArquivo = this.arquivoMock().split("\n");
      this.montarObjetosDados(linhasArquivo);
    }
  }
  montarObjetosDados(linhasArquivo: String[]) {
    let colunasArquivo: String[];
    let dataRegistro: Date;
    this.dados = new Array<RegistroAgua>();

    if (linhasArquivo)
      linhasArquivo.forEach(coluna => {
        colunasArquivo = coluna.split(";");
        colunasArquivo.forEach((coluna: string, indice) => {
          if (indice == 0) {
            let d = coluna.split(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
            dataRegistro = new Date(
              parseInt(d[1]),
              parseInt(d[2]) - 1,
              parseInt(d[3]),
              parseInt(d[4]),
              parseInt(d[5])
            );
          } else {
            let registro = new RegistroAgua(dataRegistro, +coluna);
            this.dados.push(registro);
            //Próximo registro feito após 1 minuto
            dataRegistro = new Date(dataRegistro.getTime() + 60 * 1000);
          }
        });
      });

    this.menorDataEncontrada = this.dados[0].dataRegistro.toLocaleDateString(
      "pt-br",
      this.padraoData
    );
    this.maiorDataEncontrada = this.dados[
      this.dados.length - 1
    ].dataRegistro.toLocaleDateString("pt-br", this.padraoData);

    console.log(this.dados);
    this.dadosLidos = true;

    this.preencherDadosFiltrados(this.filtro);

    if (this.dadosFiltrados) {
      this.calcularParametros(this.dadosFiltrados);
    }
  }

  preencherDadosFiltrados(filtro: { DataInicial: Date; DataFinal: Date }) {
    this.dadosFiltrados = new Array<RegistroAgua>();

    this.dados.forEach(registro => {
      if (
        (!filtro.DataInicial || registro.dataRegistro >= filtro.DataInicial) &&
        (!filtro.DataFinal || registro.dataRegistro <= filtro.DataFinal)
      )
        this.dadosFiltrados.push(registro);
    });
  }

  calcularParametros(arrayDados: Array<RegistroAgua>) {
    let fluxoTotal: number = 0;
    let maiorFluxo: RegistroAgua = arrayDados[0];
    let menorFluxo: RegistroAgua = arrayDados[0];

    arrayDados.forEach(dado => {
      fluxoTotal += dado.valorRegistro;
      maiorFluxo =
        maiorFluxo.valorRegistro <= dado.valorRegistro ? dado : maiorFluxo;
      menorFluxo =
        menorFluxo.valorRegistro >= dado.valorRegistro ? dado : menorFluxo;
    });

    this.parametros = { fluxoTotal, maiorFluxo, menorFluxo };
  }

  agruparDados(
    arrayDados: Array<RegistroAgua>,
    tamanhoGrupo: number
  ): Array<DadosResumidosAgua> {
    let grupoRegistros: Array<RegistroAgua> = new Array<RegistroAgua>();
    let dadosResumidos: Array<DadosResumidosAgua> = new Array<
      DadosResumidosAgua
    >();

    arrayDados.forEach((dado, index) => {
      if (index == 0 || index % tamanhoGrupo != 0) {
        grupoRegistros.push(dado);
      } else {
        dadosResumidos.push(new DadosResumidosAgua(grupoRegistros));
        //Limpando o array pra formar um novo grupo
        grupoRegistros = new Array<RegistroAgua>();
      }
    });

    //Se houver registros que ainda não foram agrupados pelo tamanho, cria um ultimo grupo
    if (grupoRegistros.length > 0)
      dadosResumidos.push(new DadosResumidosAgua(grupoRegistros));

    return dadosResumidos;
  }

  montarArraysChart(arrayDados: Array<DadosResumidosAgua>) {
    let valores: number[] = [];
    let datas: string[] = [];
    this.lineChartData = new Array<any>();
    this.lineChartLabels = new Array<any>();

    arrayDados.forEach(registro => {
      valores.push(registro.valorMedio);
      datas.push(
        registro.dataInicialRegistro.toLocaleDateString(
          "pt-br",
          this.padraoData
        )
      );
    });

    console.log(valores, datas);
    this.lineChartData = [{ data: valores, label: "Vazão de água" }];
    this.lineChartLabels = datas;
  }

  mostrarGrafico(formato) {
    if (formato == "hora") {
      //Agrupar por hora (60 minutos)
      this.dadosPorHora = this.agruparDados(this.dadosFiltrados, 60);
      this.montarArraysChart(this.dadosPorHora);
      this.exibirGraficoHora = true;
      this.exibirGraficoDia = false;
    } else if (formato == "dia") {
      //Agrupar por dia (1440 minutos)
      this.dadosPorDia = this.agruparDados(this.dadosFiltrados, 1440);
      this.montarArraysChart(this.dadosPorDia);
      this.exibirGraficoHora = false;
      this.exibirGraficoDia = true;
    }
  }

  public lineChartData: Array<
    any
  >; /* = [
    {data: [65, 59, 80], label: 'Vazão de água'}
  ];*/
  public lineChartLabels: Array<
    any
  >; /* = ['10/09/2018 - 10:00', '11/09/2018 - 10:00', '12/09/2018 - 10:00',];*/
  public lineChartOptions: any = {
    responsive: true
  };
  public lineChartColors: Array<any> = [
    {
      // grey
      backgroundColor: "rgba(148,159,177,0.2)",
      borderColor: "rgba(148,159,177,1)",
      pointBackgroundColor: "rgba(148,159,177,1)",
      pointBorderColor: "#fff",
      pointHoverBackgroundColor: "#fff",
      pointHoverBorderColor: "rgba(148,159,177,0.8)"
    }
  ];
  public lineChartLegend: boolean = false;
  public lineChartType: string = "line";

  // events
  public chartClicked(e: any): void {
    console.log(e);
  }

  public chartHovered(e: any): void {
    console.log(e);
  }

  mostrarFiltros() {
    let profileModal = this.modalCtrl.create(FiltrarDados);
    profileModal.onDidDismiss(data => {
      this.filtro = data;
    });
    profileModal.present();
  }

  arquivoMock(): string {
    return `2018-09-20T00:00;8.70;8.71;8.72;8.73;8.74;8.75;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129
2018-09-20T01:00;8.74;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129;8.130;8.131;8.132;8.133;8.134;8.135;8.136;8.137;8.138;8.139;8.140;8.141;8.142;8.143;8.144
2018-09-20T02:00;8.70;8.71;8.72;8.73;8.74;8.75;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129
2018-09-20T03:00;8.74;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129;8.130;8.131;8.132;8.133;8.134;8.135;8.136;8.137;8.138;8.139;8.140;8.141;8.142;8.143;8.144
2018-09-20T04:00;8.70;8.70;8.71;8.72;8.73;8.74;8.75;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128
2018-09-20T05:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T06:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T07:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T08:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T09:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T10:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T11:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T12:00;8.70;8.71;8.72;8.73;8.74;8.75;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129
2018-09-20T13:00;8.74;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129;8.130;8.131;8.132;8.133;8.134;8.135;8.136;8.137;8.138;8.139;8.140;8.141;8.142;8.143;8.144
2018-09-20T14:00;8.70;8.70;8.71;8.72;8.73;8.74;8.75;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128
2018-09-20T15:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T16:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T17:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T18:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T19:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T20:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T21:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T22:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-20T23:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-21T00:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73
2018-09-21T01:00;8.70;8.70;8.70;8.70;8.70;8.70;8.70;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119
2018-09-21T02:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;0.1;0.2;0.1;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118;8.119;8.120;8.121;8.122;8.123;8.124;8.125;8.126;8.127;8.128;8.129;8.130;8.131;8.132;8.133;8.134
2018-09-21T03:00;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;8.73;8.70;8.70;8.71;8.72;0.1;0.2;0.1;8.76;8.77;8.78;8.79;8.80;8.81;8.82;8.83;8.84;8.85;8.86;8.87;8.88;8.89;8.90;8.91;8.92;8.93;8.94;8.95;8.96;8.97;8.98;8.99;8.100;8.101;8.102;8.103;8.104;8.105;8.106;8.107;8.108;8.109;8.110;8.111;8.112;8.113;8.114;8.115;8.116;8.117;8.118
`;
  }
}

@Component({
  template: `
  <ion-header>
  <ion-toolbar>
    <ion-buttons left>  
      <button ion-button (click)="dismiss()">        
        <ion-icon name="close"></ion-icon>
      </button>
    </ion-buttons>  
    <ion-title>
      Filtrar Dados
    </ion-title>    
  </ion-toolbar>
</ion-header>
<ion-content>
<ion-row>
  <ion-item-divider>
      <b>PERÍODO</b>
  </ion-item-divider>
</ion-row>
<ion-row>
<ion-col>
  <ion-item>
    <ion-label floating>De</ion-label>
    <ion-datetime displayFormat="DD/MM/YYYY - HH:mm" [(ngModel)]="filtro.DataInicial"></ion-datetime>
  </ion-item>
</ion-col>
<ion-col>
  <ion-item>
    <ion-label floating>Até</ion-label>
    <ion-datetime displayFormat="DD/MM/YYYY - HH:mm" [(ngModel)]="filtro.DataFinal"></ion-datetime>
  </ion-item>
</ion-col>
</ion-row>
</ion-content>`
})
export class FiltrarDados {
  filtro: { DataInicial: Date; DataFinal: Date };

  constructor(public viewCtrl: ViewController) {
    this.filtro = {
      DataInicial: new Date(),
      DataFinal: new Date()
    };
  }

  dismiss() {
    let data = this.filtro;
    this.viewCtrl.dismiss(data);
  }
}
