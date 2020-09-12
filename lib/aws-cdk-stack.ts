import * as cdk from "@aws-cdk/core"
import * as S3 from "@aws-cdk/aws-s3"
import * as IAM from "@aws-cdk/aws-iam"
import * as Codebuild from "@aws-cdk/aws-codebuild"
import * as cfg from "./config"

export class AwsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // S3 bucket for a static website
    const bucket = new S3.Bucket(this, cfg.BUCKET_NAME, {
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    bucket.grantPublicAccess("*", "s3:GetObject")

    // codebuild project setup
    const webhooks: Codebuild.FilterGroup[] = [
      Codebuild.FilterGroup.inEventOf(
        Codebuild.EventAction.PUSH,
        Codebuild.EventAction.PULL_REQUEST_MERGED
      ).andHeadRefIs(cfg.BUILD_BRANCH),
    ]

    const repo = Codebuild.Source.gitHub({
      owner: cfg.REPO_OWNER,
      repo: cfg.REPO_NAME,
      webhook: true,
      webhookFilters: webhooks,
      reportBuildStatus: true,
    })

    const project = new Codebuild.Project(this, `${cfg.WEBSITE_NAME}-build`, {
      buildSpec: Codebuild.BuildSpec.fromSourceFilename("buildspec.yml"),
      projectName: `${cfg.WEBSITE_NAME}-build`,
      environment: {
        buildImage: Codebuild.LinuxBuildImage.STANDARD_3_0,
        computeType: Codebuild.ComputeType.SMALL,
        environmentVariables: {
          S3_BUCKET: {
            value: bucket.bucketName,
          },
        },
      },
      source: repo,
      timeout: cdk.Duration.minutes(20),
    })

    // iam policy to push your build to S3
    project.addToRolePolicy(
      new IAM.PolicyStatement({
        effect: IAM.Effect.ALLOW,
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        actions: [
          "s3:GetBucket*",
          "s3:List*",
          "s3:GetObject*",
          "s3:DeleteObject",
          "s3:PutObject",
        ],
      })
    )
  }
}
