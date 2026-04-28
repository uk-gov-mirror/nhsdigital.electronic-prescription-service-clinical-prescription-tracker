import {Fn, RemovalPolicy} from "aws-cdk-lib"
import {ManagedPolicy} from "aws-cdk-lib/aws-iam"
import {Construct} from "constructs"
import {TypescriptLambdaFunction} from "@nhsdigital/eps-cdk-constructs"
import {Code, LayerVersion} from "aws-cdk-lib/aws-lambda"
import {join, resolve} from "path"

export interface FunctionsProps {
  readonly stackName: string
  readonly version: string
  readonly commitId: string
  readonly targetSpineServer: string
  readonly logRetentionInDays: number
  readonly logLevel: string
}

const baseDir = resolve(__dirname, "../../..")

export class Functions extends Construct {
  functions: {[key: string]: TypescriptLambdaFunction}

  public constructor(scope: Construct, id: string, props: FunctionsProps){
    super(scope, id)

    // Imports
    const lambdaAccessSecretsPolicy = ManagedPolicy.fromManagedPolicyArn(
      this, "lambdaAccessSecretsPolicy", Fn.importValue("secrets-cdk:IAM:LambdaAccessSecretsPolicy:Arn"))

    const lambdaDecryptSecretsKMSPolicy = ManagedPolicy.fromManagedPolicyArn(
      this, "lambdaDecryptSecretsKMSPolicy", Fn.importValue("secrets-cdk:IAM:LambdaDecryptSecretsKMSPolicy:Arn"))

    const lambdaDefaultEnvironmentVariables: {[key: string]: string} = {
      NODE_OPTIONS: "--enable-source-maps",
      TargetSpineServer: props.targetSpineServer,
      SpinePrivateKeyARN: Fn.importValue("secrets-cdk:Secrets:SpinePrivateKey:Arn"),
      SpinePublicCertificateARN: Fn.importValue("secrets-cdk:Secrets:SpinePublicCertificate:Arn"),
      SpineASIDARN: Fn.importValue("secrets-cdk:Secrets:SpineASID:Arn"),
      SpinePartyKeyARN: Fn.importValue("secrets-cdk:Secrets:SpinePartyKey:Arn"),
      SpineCAChainARN: Fn.importValue("secrets-cdk:Secrets:SpineCAChain:Arn"),
      VERSION_NUMBER: props.version,
      COMMIT_ID: props.commitId,
      AWS_LAMBDA_EXEC_WRAPPER: "/opt/get-secrets-layer"
    }

    const getSecretsLambdaLayer = new LayerVersion(this, "GetSecretsLambdaLayer", {
      description: "get secrets layer",
      code: Code.fromAsset(join(baseDir, "packages/getSecretLayer/lib/get-secrets-layer.zip")),
      removalPolicy: RemovalPolicy.RETAIN
    })

    // Resources
    const prescriptionSearchLambda = new TypescriptLambdaFunction(this, "PrescriptionSearchLambda", {
      functionName: `${props.stackName}-PrescriptionSearch`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/prescriptionSearch",
      entryPoint: "src/handler.ts",
      environmentVariables: {...lambdaDefaultEnvironmentVariables},
      layers: [getSecretsLambdaLayer],
      additionalPolicies: [lambdaAccessSecretsPolicy, lambdaDecryptSecretsKMSPolicy],
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    const clinicalViewLambda = new TypescriptLambdaFunction(this, "ClinicalViewLambda", {
      functionName: `${props.stackName}-ClinicalView`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/clinicalView",
      entryPoint: "src/handler.ts",
      environmentVariables: {...lambdaDefaultEnvironmentVariables},
      layers: [getSecretsLambdaLayer],
      additionalPolicies: [lambdaAccessSecretsPolicy, lambdaDecryptSecretsKMSPolicy],
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    const statusLambda = new TypescriptLambdaFunction(this, "StatusLambda", {
      functionName: `${props.stackName}-Status`,
      projectBaseDir: baseDir,
      packageBasePath: "packages/status",
      entryPoint: "src/handler.ts",
      environmentVariables: {...lambdaDefaultEnvironmentVariables},
      layers: [getSecretsLambdaLayer],
      additionalPolicies: [lambdaAccessSecretsPolicy, lambdaDecryptSecretsKMSPolicy],
      logRetentionInDays: props.logRetentionInDays,
      logLevel: props.logLevel,
      version: props.version,
      commitId: props.commitId
    })

    this.functions = {
      prescriptionSearch: prescriptionSearchLambda,
      clinicalView: clinicalViewLambda,
      status: statusLambda
    }
  }
}
