public class MyOrder
   2 {
   3     public string OrderId { get; set; }
   4     public int Quantity { get; set; }
   5 }

  2. A sample unit test method (using MSTest syntax):

    1 using Microsoft.VisualStudio.TestTools.UnitTesting;
    2 using Azure.Messaging.ServiceBus; // You need this namespace
    3 using System.Text.Json;
    4 using System.Text;
    5
    6 [TestClass]
    7 public class MyFunctionTests
    8 {
    9     [TestMethod]
   10     public void Test_MyFunction_Processes_Order()
   11     {
   12         // --- 1. Arrange ---
   13
   14         // First, create the business object (your payload)
   15         var myOrderPayload = new MyOrder { OrderId = "ABC-123", Quantity = 10 };
   16
   17         // Serialize your business object to a JSON string
   18         var jsonPayload = JsonSerializer.Serialize(myOrderPayload);
   19
   20         // Now, use the factory to create the test message.
   21         // The body must be provided as BinaryData.
   22         ServiceBusReceivedMessage testMessage = ServiceBusModelFactory.ServiceBusReceivedMessage(
   23             body: BinaryData.FromString(jsonPayload),
   24             messageId: "test-message-01",
   25             contentType: "application/json"
   26             // You can also set other properties like ApplicationProperties, etc.
   27         );
   28
   29
