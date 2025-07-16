import json
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException, StaleElementReferenceException, WebDriverException
from selenium.webdriver.common.action_chains import ActionChains

class RecutClubScraper:
    def __init__(self, headless=False):
        """Initialize the RecutClub scraper"""
        self.base_url = "https://recutclub.com"
        
        # Configure Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--memory-pressure-off")
        chrome_options.add_argument("--max_old_space_size=4096")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print("🚀 Starting Chrome browser for RecutClub Scraper...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.wait = WebDriverWait(self.driver, 30)
        
        # Keep track of data to avoid duplicates
        self.seen_case_urls = set()
        self.seen_image_urls = set()
        self.all_cases = []
        
    def __del__(self):
        """Clean up the browser when done"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def login(self, username, password):
        """Login to RecutClub"""
        try:
            print(f"🔐 Attempting to login to {self.base_url}")
            self.driver.get(self.base_url)
            
            # Wait for page to load
            time.sleep(5)
            
            # Find and click login button/link
            try:
                login_selectors = [
                    "a:contains('Login')",
                    "button:contains('Login')", 
                    "a:contains('Sign In')",
                    "button:contains('Sign In')",
                    ".login-btn",
                    "#login",
                    "a[href*='login']",
                    "button[data-toggle='modal']"
                ]
                
                login_element = None
                for selector in login_selectors:
                    try:
                        if ":contains" in selector:
                            text = selector.split("'")[1]
                            xpath_selector = f"//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                            login_element = self.driver.find_element(By.XPATH, xpath_selector)
                        else:
                            login_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if login_element and login_element.is_displayed():
                            print(f"   ✅ Found login element")
                            break
                    except NoSuchElementException:
                        continue
                
                if login_element:
                    self.driver.execute_script("arguments[0].click();", login_element)
                    time.sleep(3)
                
                # Fill in credentials - try multiple field selectors
                email_selectors = [
                    "input[type='email']",
                    "input[name='email']",
                    "input[name='username']",
                    "input[id*='email']",
                    "input[id*='username']"
                ]
                
                password_selectors = [
                    "input[type='password']",
                    "input[name='password']",
                    "input[id*='password']"
                ]
                
                email_field = None
                for selector in email_selectors:
                    try:
                        email_field = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if email_field.is_displayed():
                            break
                    except NoSuchElementException:
                        continue
                
                password_field = None
                for selector in password_selectors:
                    try:
                        password_field = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if password_field.is_displayed():
                            break
                    except NoSuchElementException:
                        continue
                
                if email_field and password_field:
                    email_field.clear()
                    email_field.send_keys(username)
                    password_field.clear()
                    password_field.send_keys(password)
                    
                    # Submit login
                    submit_selectors = [
                        "button[type='submit']",
                        "input[type='submit']",
                        "button:contains('Login')",
                        "button:contains('Sign In')"
                    ]
                    
                    submit_button = None
                    for selector in submit_selectors:
                        try:
                            if ":contains" in selector:
                                text = selector.split("'")[1]
                                xpath_selector = f"//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                                submit_button = self.driver.find_element(By.XPATH, xpath_selector)
                            else:
                                submit_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                            if submit_button and submit_button.is_displayed():
                                break
                        except NoSuchElementException:
                            continue
                    
                    if submit_button:
                        submit_button.click()
                        print("   🔄 Submitted login form, waiting for response...")
                        time.sleep(8)
                    
                    # Check if login was successful by looking for user-specific content
                    try:
                        # Look for any sign of successful login (user menu, logout link, etc.)
                        success_indicators = [
                            ".user-menu",
                            "a:contains('Logout')",
                            "a:contains('My Cases')",
                            "[class*='user']",
                            ".dropdown-toggle"
                        ]
                        
                        login_successful = False
                        for indicator in success_indicators:
                            try:
                                if ":contains" in indicator:
                                    text = indicator.split("'")[1]
                                    xpath_selector = f"//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                                    element = self.driver.find_element(By.XPATH, xpath_selector)
                                else:
                                    element = self.driver.find_element(By.CSS_SELECTOR, indicator)
                                if element and element.is_displayed():
                                    login_successful = True
                                    break
                            except:
                                continue
                        
                        if login_successful:
                            print("   ✅ Login successful!")
                            return True
                        else:
                            print("   ❌ Login may have failed - no success indicators found")
                            return False
                    except Exception as e:
                        print(f"   ⚠️ Could not verify login status: {e}")
                        return True  # Assume success if we can't verify
                else:
                    print("   ❌ Could not find email/password fields")
                    return False
                    
            except Exception as e:
                print(f"   ❌ Error during login process: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error accessing login page: {e}")
            return False
    
    def navigate_to_study_page(self):
        """Navigate to the study page with the filtering options"""
        try:
            print("📚 Navigating to Study page...")
            
            # Look for Study link
            study_selectors = [
                "a:contains('Study')",
                "a[href*='study']",
                ".nav-link:contains('Study')"
            ]
            
            study_link = None
            for selector in study_selectors:
                try:
                    if ":contains" in selector:
                        text = selector.split("'")[1]
                        xpath_selector = f"//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text.lower()}')]"
                        study_link = self.driver.find_element(By.XPATH, xpath_selector)
                    else:
                        study_link = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if study_link and study_link.is_displayed():
                        break
                except NoSuchElementException:
                    continue
            
            if study_link:
                self.driver.execute_script("arguments[0].click();", study_link)
                time.sleep(5)
                print("   ✅ Navigated to Study page")
            else:
                print("   ⚠️ Study link not found, assuming already on correct page")
            
            # Verify we can see the filtering dropdowns
            try:
                topic_dropdown = self.driver.find_element(By.CSS_SELECTOR, "#topic_selection")
                conference_dropdown = self.driver.find_element(By.CSS_SELECTOR, "#conference_selection")
                
                if topic_dropdown and conference_dropdown:
                    print("   ✅ Found filtering dropdowns")
                    return True
                else:
                    print("   ❌ Could not find expected dropdowns")
                    return False
            except:
                print("   ❌ Could not find filtering dropdowns")
                return False
                
        except Exception as e:
            print(f"❌ Error navigating to study page: {e}")
            return False

    def get_topics(self):
        """Get all available topics from the topic dropdown"""
        try:
            print("🔍 Getting available topics...")
            
            # Find the topic dropdown
            topic_dropdown = self.driver.find_element(By.CSS_SELECTOR, "#topic_selection")
            
            if not topic_dropdown:
                print("   ❌ Could not find topic dropdown")
                return []
            
            # Extract topics from dropdown
            topics = []
            try:
                select = Select(topic_dropdown)
                options = select.options
                
                for option in options:
                    value = option.get_attribute('value')
                    text = option.text.strip()
                    
                    # Skip empty options
                    if text and value and text.lower() not in ['', 'select']:
                        topics.append({
                            'name': text,
                            'value': value,
                            'dropdown': topic_dropdown
                        })
                
                print(f"📊 Found {len(topics)} topics:")
                for i, topic in enumerate(topics):
                    print(f"   {i+1}. {topic['name']}")
                
                return topics
                
            except Exception as e:
                print(f"   ❌ Error extracting topics: {e}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting topics: {e}")
            return []
    
    def select_topic(self, topic):
        """Select a specific topic"""
        try:
            print(f"\n🔍 Selecting topic: {topic['name']}")
            
            # Select from dropdown
            select = Select(topic['dropdown'])
            select.select_by_value(topic['value'])
            print(f"   ✅ Selected {topic['name']} from dropdown")
            
            # Wait for topic change to take effect
            time.sleep(3)
            
            return True
            
        except Exception as e:
            print(f"   ❌ Error selecting topic {topic['name']}: {e}")
            return False

    def get_conferences_for_topic(self, topic_name):
        """Get all available conferences for the selected topic"""
        try:
            print(f"   🔍 Getting conferences for {topic_name}...")
            
            # Find the conference dropdown
            conference_dropdown = self.driver.find_element(By.CSS_SELECTOR, "#conference_selection")
            
            if not conference_dropdown:
                print("   ❌ Could not find conference dropdown")
                return []
            
            # Extract conferences from dropdown
            conferences = []
            try:
                select = Select(conference_dropdown)
                options = select.options
                
                for option in options:
                    value = option.get_attribute('value')
                    text = option.text.strip()
                    data_merged = option.get_attribute('data-merged')
                    
                    # Skip empty options
                    if text and value and text.lower() not in ['', 'select']:
                        conferences.append({
                            'name': text,
                            'value': value,
                            'data_merged': data_merged,
                            'topic': topic_name,
                            'dropdown': conference_dropdown
                        })
                
                print(f"      Found {len(conferences)} conferences for {topic_name}")
                for conf in conferences[:3]:  # Show first 3
                    print(f"        - {conf['name']}")
                if len(conferences) > 3:
                    print(f"        ... and {len(conferences) - 3} more")
                
                return conferences
                
            except Exception as e:
                print(f"   ❌ Error extracting conferences: {e}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting conferences for {topic_name}: {e}")
            return []

    def select_conference(self, conference):
        """Select a specific conference and load its cases"""
        try:
            print(f"   📅 Selecting conference: {conference['name']}")
            
            # Select from dropdown
            select = Select(conference['dropdown'])
            select.select_by_value(conference['value'])
            print(f"      ✅ Selected {conference['name']}")
            
            # Wait for conference change to load cases
            time.sleep(5)
            
            # Wait for cases to load
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#casesFromConference")))
                print(f"      ✅ Cases loaded for {conference['name']}")
                return True
            except TimeoutException:
                print(f"      ⚠️ Timeout waiting for cases to load")
                return True  # Continue anyway
            
        except Exception as e:
            print(f"   ❌ Error selecting conference {conference['name']}: {e}")
            return False

    def extract_cases_from_conference(self, conference):
        """Extract all cases from the currently selected conference"""
        try:
            print(f"      📋 Extracting cases from {conference['name']}...")
            
            # Wait a bit for content to fully load
            time.sleep(3)
            
            # Find the cases container
            cases_container = self.driver.find_element(By.CSS_SELECTOR, "#casesFromConference")
            
            if not cases_container:
                print(f"      ⚠️ No cases container found")
                return []
            
            # Find all case cards
            case_cards = cases_container.find_elements(By.CSS_SELECTOR, ".card")
            
            if not case_cards:
                print(f"      ⚠️ No case cards found in {conference['name']}")
                return []
            
            print(f"         Found {len(case_cards)} case cards")
            
            conference_cases = []
            
            for i, card in enumerate(case_cards):
                try:
                    case_data = self.extract_single_case(card, i, conference)
                    if case_data:
                        # Check for duplicates using case URL
                        case_url = case_data.get('case_url', '')
                        if case_url and case_url not in self.seen_case_urls:
                            self.seen_case_urls.add(case_url)
                            conference_cases.append(case_data)
                        elif not case_url:
                            # Fallback for cases without URL
                            fallback_id = f"{case_data['case_title']}_{case_data['history']}_{conference['name']}"
                            if fallback_id not in self.seen_case_urls:
                                self.seen_case_urls.add(fallback_id)
                                conference_cases.append(case_data)
                        
                except Exception as e:
                    print(f"         ⚠️ Error extracting case {i+1}: {e}")
                    continue
            
            print(f"      ✅ Extracted {len(conference_cases)} unique cases from {conference['name']}")
            return conference_cases
            
        except Exception as e:
            print(f"      ❌ Error extracting cases from {conference['name']}: {e}")
            return []

    def extract_single_case(self, case_card, index, conference):
        """Extract information from a single case card"""
        case_data = {
            'case_title': '',
            'case_url': '',
            'image_url': '',
            'history': '',
            'diagnosis': '',
            'topic': conference['topic'],
            'conference': conference['name'],
            'conference_value': conference['value'],
            'metadata': {}
        }
        
        try:
            # Extract case title
            try:
                title_element = case_card.find_element(By.CSS_SELECTOR, ".card-title")
                case_data['case_title'] = title_element.text.strip()
            except:
                case_data['case_title'] = f"Case {index + 1}"
            
            # Extract case URL from the image link
            try:
                link_element = case_card.find_element(By.CSS_SELECTOR, "a[href*='caseViewer']")
                case_url = link_element.get_attribute('href')
                if case_url:
                    # Convert relative URLs to absolute
                    if case_url.startswith('/'):
                        case_url = self.base_url + case_url
                    elif not case_url.startswith('http'):
                        case_url = self.base_url + '/' + case_url
                    case_data['case_url'] = case_url
            except:
                pass
            
            # Extract image URL
            try:
                img_element = case_card.find_element(By.CSS_SELECTOR, "img")
                img_src = img_element.get_attribute('src')
                if img_src and img_src not in self.seen_image_urls:
                    self.seen_image_urls.add(img_src)
                    case_data['image_url'] = img_src
            except:
                pass
            
            # Extract history and diagnosis from tabs
            try:
                # Look for tab content
                tab_contents = case_card.find_elements(By.CSS_SELECTOR, ".tab-pane")
                
                for tab_content in tab_contents:
                    tab_id = tab_content.get_attribute('id')
                    if tab_id:
                        # Check if this is history or diagnosis based on tab structure
                        panel_body = tab_content.find_element(By.CSS_SELECTOR, ".panel-body")
                        text_content = panel_body.text.strip()
                        
                        # Look for corresponding tab link to determine type
                        try:
                            tab_link = case_card.find_element(By.CSS_SELECTOR, f"a[href='#{tab_id}']")
                            tab_text = tab_link.text.strip().lower()
                            
                            if 'history' in tab_text:
                                case_data['history'] = text_content
                            elif 'diagnosis' in tab_text:
                                case_data['diagnosis'] = text_content
                        except:
                            # Fallback: if no tab link found, assume first is history, second is diagnosis
                            if not case_data['history']:
                                case_data['history'] = text_content
                            elif not case_data['diagnosis']:
                                case_data['diagnosis'] = text_content
            except Exception as e:
                print(f"            ⚠️ Error extracting history/diagnosis: {e}")
            
            # Debug: Print first few cases from each conference
            if index < 3:
                print(f"           Sample {index+1}: '{case_data['case_title']}' - {case_data['history'][:50]}...")
            
            # Only return cases with meaningful data
            if case_data['case_title'] and (case_data['history'] or case_data['diagnosis']):
                return case_data
            else:
                return None
            
        except Exception as e:
            print(f"           ⚠️ Error extracting single case: {e}")
            return None

    def scrape_topic_with_conferences(self, topic):
        """Scrape all conferences for a specific topic"""
        print(f"\n🔍 Scraping topic: {topic['name']}")
        
        # Select the topic
        if not self.select_topic(topic):
            print(f"❌ Failed to select topic {topic['name']}")
            return []
        
        # Get conferences for this topic
        conferences = self.get_conferences_for_topic(topic['name'])
        
        if not conferences:
            print(f"   ⚠️ No conferences found for {topic['name']}")
            return []
        
        topic_cases = []
        
        for i, conference in enumerate(conferences, 1):
            print(f"\n   [{i}/{len(conferences)}] Processing conference: {conference['name']}")
            
            try:
                # Select this conference
                if self.select_conference(conference):
                    # Extract cases from this conference
                    conference_cases = self.extract_cases_from_conference(conference)
                    topic_cases.extend(conference_cases)
                    
                    # Show summary
                    if conference_cases:
                        print(f"      📊 Conference {conference['name']}: {len(conference_cases)} cases")
                        # Show sample case
                        if len(conference_cases) > 0:
                            sample = conference_cases[0]
                            history = sample['history'][:40] + '...' if len(sample['history']) > 40 else sample['history']
                            print(f"         Sample: {sample['case_title']} - {history}")
                    else:
                        print(f"      ⚠️ No cases found in {conference['name']}")
                
                # Be respectful between conferences
                time.sleep(2)
                
            except Exception as e:
                print(f"      ❌ Error processing conference {conference['name']}: {e}")
                continue
        
        print(f"\n✅ Finished topic {topic['name']}: {len(topic_cases)} total cases")
        return topic_cases

    def scrape_all_topics(self, username, password, specific_topics=None, max_topics=None):
        """Main scraping function for all topics"""
        print("=== RecutClub Scraper ===\n")
        print("🎯 Target: Educational pathology cases from RecutClub")
        print("📋 Features: Topic/conference navigation, case extraction")
        print()
        
        # Login
        if not self.login(username, password):
            print("❌ Login failed. Please check your credentials.")
            return []
        
        # Navigate to study page
        if not self.navigate_to_study_page():
            print("❌ Failed to navigate to study page")
            return []
        
        # Get topics
        topics = self.get_topics()
        if not topics:
            print("❌ No topics found")
            return []
        
        # Filter topics if specific ones are requested
        if specific_topics:
            topics = [topic for topic in topics if topic['name'] in specific_topics]
            print(f"🎯 Filtering to specific topics: {specific_topics}")
        
        # Limit topics for testing
        if max_topics:
            topics = topics[:max_topics]
            print(f"🧪 Testing with first {len(topics)} topics")
        
        total_cases = 0
        
        print(f"\n🚀 Starting to scrape {len(topics)} topics...")
        
        for i, topic in enumerate(topics, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(topics)}] Processing: {topic['name']}")
            print(f"{'='*60}")
            
            try:
                # Scrape this topic with all its conferences
                topic_cases = self.scrape_topic_with_conferences(topic)
                
                # Add to global collection
                self.all_cases.extend(topic_cases)
                
                total_cases += len(topic_cases)
                
                print(f"\n📊 {topic['name']} Summary:")
                print(f"   - Cases: {len(topic_cases)}")
                print(f"   - Running total: {total_cases} cases")
                
                # Be respectful between topics
                time.sleep(3)
                
            except Exception as e:
                print(f"   ❌ Error processing {topic['name']}: {e}")
                continue
        
        # Save final results
        self.save_results()
        
        return self.all_cases
    
    def save_results(self):
        """Save comprehensive results to JSON file"""
        output_file = 'recutclub_cases.json'
        
        try:
            # Add final metadata to each case
            for case in self.all_cases:
                case['has_image'] = bool(case.get('image_url'))
                case['has_case_url'] = bool(case.get('case_url'))
                case['has_history'] = bool(case.get('history'))
                case['has_diagnosis'] = bool(case.get('diagnosis'))
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.all_cases, f, indent=2, ensure_ascii=False)
            
            print(f"\n{'='*60}")
            print(f"🎉 SCRAPING COMPLETED!")
            print(f"{'='*60}")
            print(f"📁 Saved {len(self.all_cases)} cases to {output_file}")
            
            # Comprehensive statistics
            topics_processed = len(set(case['topic'] for case in self.all_cases))
            conferences_processed = len(set(case['conference'] for case in self.all_cases))
            cases_with_history = sum(1 for case in self.all_cases if case['history'])
            cases_with_diagnosis = sum(1 for case in self.all_cases if case['diagnosis'])
            cases_with_images = sum(1 for case in self.all_cases if case['image_url'])
            cases_with_urls = sum(1 for case in self.all_cases if case.get('case_url'))
            
            print(f"📊 FINAL SUMMARY:")
            print(f"   - Topics processed: {topics_processed}")
            print(f"   - Conferences processed: {conferences_processed}")
            print(f"   - Total cases: {len(self.all_cases)}")
            print(f"   - Cases with history: {cases_with_history}")
            print(f"   - Cases with diagnosis: {cases_with_diagnosis}")
            print(f"   - Cases with images: {cases_with_images}")
            print(f"   - Cases with URLs: {cases_with_urls}")
            print(f"   - Unique image URLs: {len(self.seen_image_urls)}")
            print(f"   - Unique case URLs: {len(self.seen_case_urls)}")
            
            # Topic breakdown
            print(f"\n📋 Topic Breakdown:")
            topic_counts = {}
            for case in self.all_cases:
                topic = case['topic']
                topic_counts[topic] = topic_counts.get(topic, 0) + 1
            
            for topic, count in sorted(topic_counts.items()):
                print(f"   - {topic}: {count} cases")
            
            # Conference breakdown
            print(f"\n📅 Conference Breakdown:")
            conference_counts = {}
            for case in self.all_cases:
                conf = case['conference']
                conference_counts[conf] = conference_counts.get(conf, 0) + 1
            
            for conference, count in sorted(conference_counts.items()):
                print(f"   - {conference}: {count} cases")
            
            # Show sample cases
            if len(self.all_cases) > 0:
                print(f"\n📋 Sample cases:")
                for case in self.all_cases[:10]:
                    title = case['case_title']
                    history = case['history'][:50] + '...' if len(case['history']) > 50 else case['history']
                    print(f"   - {case['topic']}/{case['conference']}: {title}")
                    if history:
                        print(f"     📝 History: {history}")
                    if case.get('case_url'):
                        print(f"     🔗 URL: {case['case_url']}")
            
            # Save detailed stats
            stats_file = 'recutclub_stats.json'
            stats = {
                'scraping_type': 'RecutClub Educational Cases',
                'topics_processed': topics_processed,
                'conferences_processed': conferences_processed,
                'total_cases': len(self.all_cases),
                'cases_with_history': cases_with_history,
                'cases_with_diagnosis': cases_with_diagnosis,
                'cases_with_images': cases_with_images,
                'cases_with_urls': cases_with_urls,
                'unique_image_urls': len(self.seen_image_urls),
                'unique_case_urls': len(self.seen_case_urls),
                'topic_breakdown': topic_counts,
                'conference_breakdown': conference_counts,
                'scraping_timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            print(f"📈 Detailed stats saved to {stats_file}")
            
        except Exception as e:
            print(f"❌ Error saving results: {e}")

def main():
    """Main function"""
    print("RecutClub Scraper v1.0")
    print("======================")
    print("🎯 Scrapes educational pathology cases from RecutClub")
    print("📋 Features: Topic/conference navigation, case data extraction")
    print("🔗 Outputs case URLs and comprehensive metadata")
    print()
    
    # Get credentials
    username = input("Enter your RecutClub username/email: ").strip()
    password = input("Enter your RecutClub password: ").strip()
    
    if not username or not password:
        print("❌ Username and password are required")
        return
    
    print("\nChoose scraping mode:")
    print("1. Test mode (first 2 topics)")
    print("2. Complete scrape (ALL topics)")
    print("3. Specific topics (e.g., just Bone, Breast)")
    print("4. Custom number of topics")
    
    try:
        choice = input("\nEnter choice (1-4): ").strip()
        
        specific_topics = None
        max_topics = None
        
        if choice == "1":
            max_topics = 2
            print("🧪 Test mode: Will scrape first 2 topics")
        elif choice == "2":
            max_topics = None
            print("🚀 COMPLETE mode: Will scrape ALL topics")
            confirm = input("This will scrape ALL topics and conferences. Continue? (y/n): ").strip().lower()
            if confirm not in ['y', 'yes']:
                print("Cancelled.")
                return
        elif choice == "3":
            categories_input = input("Enter topics separated by commas (e.g., Bone, Breast, Cytology): ").strip()
            specific_topics = [cat.strip() for cat in categories_input.split(',')]
            print(f"🎯 Will scrape specific topics: {specific_topics}")
        elif choice == "4":
            max_topics = int(input("Enter number of topics to scrape: "))
            print(f"🔢 Will scrape first {max_topics} topics")
        else:
            print("Invalid choice, using test mode")
            max_topics = 2
        
        # Ask about headless mode
        headless_choice = input("\nRun in headless mode? (y/n): ").strip().lower()
        headless = headless_choice in ['y', 'yes']
        
        print(f"\n🚀 Starting RecutClub Scraper...")
        print(f"   - Target: Educational pathology cases")
        print(f"   - Username: {username}")
        print(f"   - Mode: {'Headless' if headless else 'Visible browser'}")
        if specific_topics:
            print(f"   - Topics: {specific_topics}")
        elif max_topics:
            print(f"   - Max topics: {max_topics}")
        else:
            print(f"   - Max topics: All available")
        print()
        
        # Create scraper and run
        scraper = RecutClubScraper(headless=headless)
        results = scraper.scrape_all_topics(
            username, password, 
            specific_topics=specific_topics,
            max_topics=max_topics
        )
        
        print(f"\n🎯 MISSION ACCOMPLISHED!")
        print(f"📊 Successfully scraped {len(results)} cases from RecutClub!")
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n👋 Done!")

if __name__ == "__main__":
    main()