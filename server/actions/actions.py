from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet

class ActionCheckInventory(Action):
    def name(self) -> Text:
        return "action_check_inventory"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        # TODO: Implement inventory check logic
        dispatcher.utter_message(text="Let me check the inventory for you...")
        return []

class ActionProcessOrder(Action):
    def name(self) -> Text:
        return "action_process_order"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        drink = next(tracker.get_latest_entity_values("drink"), None)
        if drink:
            # TODO: Implement order processing logic
            dispatcher.utter_message(text=f"I'll process your order for {drink}")
            return [SlotSet("drink", drink)]
        else:
            dispatcher.utter_message(text="What drink would you like to order?")
            return []

class ActionGetPrice(Action):
    def name(self) -> Text:
        return "action_get_price"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        drink = next(tracker.get_latest_entity_values("drink"), None)
        if drink:
            # TODO: Implement price lookup logic
            dispatcher.utter_message(text=f"Let me check the price of {drink} for you")
            return []
        else:
            dispatcher.utter_message(text="Which drink would you like to know the price of?")
            return []

class ActionGetIngredients(Action):
    def name(self) -> Text:
        return "action_get_ingredients"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        drink = next(tracker.get_latest_entity_values("drink"), None)
        if drink:
            # TODO: Implement ingredients lookup logic
            dispatcher.utter_message(text=f"Let me tell you what goes into a {drink}")
            return []
        else:
            dispatcher.utter_message(text="Which drink would you like to know the ingredients for?")
            return []
