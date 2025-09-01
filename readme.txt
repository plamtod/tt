  1. Azure Container Apps (ACA)

  This is often the recommended and best-fit option for most new containerized functions.

   * What it is: A serverless container service specifically designed for running microservices. It's built on
     Kubernetes but hides all the complexity. It has first-class support for KEDA (Kubernetes Event-driven
     Autoscaling), which allows your function to scale from zero to many instances based on triggers like queue
     messages, event hub events, or HTTP traffic—just like a regular function.
   * When to use it:
       * For event-driven microservices where you want powerful, trigger-based autoscaling without managing a
         Kubernetes cluster.
       * When you want a simple, serverless experience for your containers.
       * It's the modern "sweet spot" between the simplicity of PaaS and the power of Kubernetes.

  2. Azure Functions Premium Plan

   * What it is: A hosting plan dedicated to Azure Functions that fully supports running custom container
     images. It's a "Functions-native" experience.
   * When to use it:
       * When you want the benefits of a custom container but prefer to stay within the familiar Azure Functions
         management and deployment ecosystem.
       * When you need features of the Premium plan, such as VNet integration, no "cold starts" (with pre-warmed
         instances), and longer execution timeouts. The platform manages the scaling for you based on your
         function triggers.

  3. Azure Kubernetes Service (AKS)

   * What it is: Azure's full-featured, managed Kubernetes service. It gives you maximum power, control, and
     flexibility over your container orchestration.
   * When to use it:
       * When your organization already uses AKS for other microservices and you want to consolidate all your
         workloads on a single platform.
       * When you need advanced Kubernetes features like a service mesh (e.g., Istio, Linkerd), custom
         networking policies, or very specific node configurations.
       * Note: This option comes with the highest operational complexity. You are responsible for managing the
         cluster, networking, ingress controllers, and the KEDA installation to enable event-driven scaling for
         your function.

  4. Azure App Service (Web App for Containers)

   * What it is: Azure's flagship PaaS for hosting web applications can also run container images. You deploy
     your container to an App Service Plan.
   * When to use it:
       * If you are already heavily invested in the App Service platform and are comfortable with its scaling
         model (based on the CPU/memory of the plan, not function triggers).
       * For simple scenarios or when you want to run your function alongside a traditional web application in
         the same App Service Plan.

The two primary mechanisms for inter-workflow communication are:
   1. Starting workflows from within another workflow.
   2. Using a general-purpose eventing system.

  Here are the common patterns and how to implement them.

  ---

  1. Parent-Child Workflows

  This is a common pattern where a "parent" workflow needs to launch and delegate a piece of work to a "child" workflow.

   * How it Works: You use the built-in StartWorkflow primitive. The parent workflow can pass initial data to the child. By default, this is a
     "fire and forget" operation—the parent starts the child and immediately moves to its next step.

   * Waiting for the Child: To make the parent wait for the child to finish, you must combine StartWorkflow with the event system. The child
     workflow must publish a "completion" event as its final step, and the parent must use a WaitFor step to listen for it.

   * Example:

      Child Workflow (`ProcessItemWorkflow.cs`)
      This workflow does some work and then publishes an event to notify its parent that it's done.

    1     public class ProcessItemData
    2     {
    3         public string ItemId { get; set; }
    4         public string ParentWorkflowId { get; set; } // So we know who to notify
    5         public string Result { get; set; }
    6     }
    7
    8     // ... in the workflow definition ...
    9     builder
   10         .StartWith<DoSomeWork>()
   11             .Output(data => data.Result, step => step.Output)
   12         .Then(context =>
   13         {
   14             // Publish a completion event
   15             var host = context.Host;
   16             var data = (ProcessItemData)context.Workflow.Data;
   17             host.PublishEvent("ChildCompleted", data.ParentWorkflowId, data.Result);
   18         });

      Parent Workflow (`MainWorkflow.cs`)
      This workflow starts the child and waits for its completion event.

    1     // ... in the workflow definition ...
    2     .Then<StartWorkflow<ProcessItemData>>() // Generic version is clean
    3         .Input(step => step.WorkflowId, "ProcessItemWorkflow")
    4         .Input(step => step.Data,  (data, context) => new ProcessItemData
    5         {
    6             ItemId = "item-123",
    7             ParentWorkflowId = context.Workflow.Id // Pass our own ID to the child
    8         })
    9     .WaitFor("ChildCompleted", context => context.Workflow.Id) // Wait for an event keyed to our ID
   10         .Output(data => data.ResultFromChild, step => step.EventData)
   11     .Then<UseChildResult>();

  ---

  2. Fan-Out / Fan-In (Parallel Processing)

  This is a more advanced version of the parent-child pattern where a parent starts multiple child workflows to run in parallel and then
  waits for all of them to complete before proceeding.

   * How it Works:
       1. Fan-Out: The parent uses a ForEach step to loop over a collection of items. Inside the loop, it uses StartWorkflow for each item.
       2. Fan-In: The parent needs to wait until all children have published their completion event. This is typically done by using a While
          loop that waits for one event at a time and increments a counter until the count of completed children matches the number of jobs
          that were started.

   * Example:

    1     // Parent Data
    2     public class ParentData
    3     {
    4         public List<string> Items { get; set; }
    5         public int CompletedChildren { get; set; } = 0;
    6     }
    7
    8     // Parent Workflow Definition
    9     .ForEach(data => data.Items)
   10         .Do(x => x
   11             .Then<StartWorkflow<ProcessItemData>>()
   12                 .Input(step => step.WorkflowId, "ProcessItemWorkflow")
   13                 .Input(step => step.Data, (data, context) => new ProcessItemData
   14                 {
   15                     ItemId = context.Item,
   16                     ParentWorkflowId = context.Workflow.Id
   17                 })
   18         )
   19     // Fan-In part: Loop until all children are done
   20     .While(data => data.CompletedChildren < data.Items.Count)
   21         .Do(x => x
   22             .WaitFor("ChildCompleted", context => context.Workflow.Id)
   23             .Then(data => data.CompletedChildren++) // Increment counter on each event
   24         )
   25     .Then<AggregateAllResults>();

  ---

  3. Decoupled Communication via Events

  Workflows don't need a parent-child relationship to communicate. Any workflow can publish an event, and any other workflow can consume it.
  This allows you to build a "choreography" of independent microservices.

   * How it Works: One workflow uses IWorkflowHost.PublishEvent() to announce that something has happened. Other workflows use WaitFor to
     listen for these announcements and trigger their own processes. The workflows do not need to know about each other's existence; they only
     need to agree on the event name and key structure.

   * Use Case:
       * Workflow A (`UserRegistration`): When a new user signs up, it finishes by publishing an event: host.PublishEvent("UserSignedUp",
         user.Id, user.Email);
       * Workflow B (`OnboardingEmails`): This workflow is designed with a StartWith that is a WaitFor step, or has a WaitFor early on. It
         listens for the UserSignedUp event and, upon receiving it, begins a week-long email onboarding sequence.
       * Workflow C (`ProvisionResources`): A third workflow could also be listening for UserSignedUp to start provisioning account resources
         for the new user.

  This event-based approach is extremely powerful for building scalable and resilient systems where different business processes can react
  to events independently.
